import * as vscode from "vscode";
import * as path from "path";
import type { ElementPickPayload, SavedPick } from "../types";
import { buildContextMarkdown } from "../capture/contextBuilder";

function stamp(): string {
  // 2026-08-01T14-32-05
  return new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
}

/**
 * Sanitize the configured output dir name. Only a workspace-relative name is
 * allowed — absolute paths, "..", empty segments, and characters invalid on
 * Windows fall back to the default so writes never escape the workspace.
 */
export function sanitizeOutputDirName(raw: string | undefined): string {
  const fallback = ".element-picks";
  const name = (raw || "").trim().replace(/[\\/]+$/, "");
  if (!name) return fallback;
  if (
    path.isAbsolute(name) ||
    /[<>:"|?*\u0000-\u001f]/.test(name) ||
    name.split(/[\\/]/).some((seg) => seg === "" || seg === "..")
  ) {
    return fallback;
  }
  return name;
}

export function getOutputDirName(): string {
  return sanitizeOutputDirName(
    vscode.workspace
      .getConfiguration("elementPicker")
      .get<string>("outputDir", ".element-picks")
  );
}

function getMaxHtmlBytes(): number {
  return (
    vscode.workspace
      .getConfiguration("elementPicker")
      .get<number>("maxHtmlBytes", 100000) || 100000
  );
}

function workspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function ensureDir(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch {
    // may already exist
  }
}

async function writeFile(uri: vscode.Uri, data: Uint8Array | string): Promise<void> {
  const buf =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  await vscode.workspace.fs.writeFile(uri, buf);
}

/**
 * Save context.md + element.png under .element-picks/<stamp>/ and copy to latest/.
 */
export async function savePick(
  payload: ElementPickPayload,
  pngBytes: Uint8Array
): Promise<SavedPick> {
  const root = workspaceRoot();
  if (!root) {
    throw new Error("Open a workspace folder to save element picks.");
  }

  const outName = getOutputDirName();
  const ts = stamp();
  const base = vscode.Uri.joinPath(root, outName);
  const folder = vscode.Uri.joinPath(base, ts);
  const latest = vscode.Uri.joinPath(base, "latest");

  await ensureDir(base);
  await ensureDir(folder);
  // Wipe latest/ first so a prior clone pack (clone/, zip, AGENT.md, …) cannot
  // sit next to a fresh light pick — agents would otherwise read mixed state.
  try {
    await vscode.workspace.fs.delete(latest, {
      recursive: true,
      useTrash: false,
    });
  } catch {
    /* may not exist */
  }
  await ensureDir(latest);

  const markdown = buildContextMarkdown(payload, getMaxHtmlBytes());
  const contextUri = vscode.Uri.joinPath(folder, "context.md");
  const imageUri = vscode.Uri.joinPath(folder, "element.png");
  const latestContext = vscode.Uri.joinPath(latest, "context.md");
  const latestImage = vscode.Uri.joinPath(latest, "element.png");

  await writeFile(contextUri, markdown);
  await writeFile(imageUri, pngBytes);
  await writeFile(latestContext, markdown);
  await writeFile(latestImage, pngBytes);

  const contextPath = contextUri.fsPath;
  const imagePath = imageUri.fsPath;

  return {
    folderUri: folder,
    contextUri,
    imageUri,
    contextPath,
    imagePath,
    selector: payload.selector,
    url: payload.url,
    timestamp: ts,
  };
}

export function getLatestPaths():
  | { contextPath: string; imagePath: string }
  | undefined {
  const root = workspaceRoot();
  if (!root) {
    return undefined;
  }
  const outName = getOutputDirName();
  const latest = vscode.Uri.joinPath(root, outName, "latest");
  return {
    contextPath: path.join(latest.fsPath, "context.md"),
    imagePath: path.join(latest.fsPath, "element.png"),
  };
}

/** Ensure .element-picks is listed in workspace .gitignore (best-effort). */
export async function ensureGitignoreEntry(): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    return;
  }
  const outName = getOutputDirName();
  const gi = vscode.Uri.joinPath(root, ".gitignore");
  try {
    const raw = await vscode.workspace.fs.readFile(gi);
    const text = new TextDecoder().decode(raw);
    if (text.split(/\r?\n/).some((l) => l.trim() === outName || l.trim() === `${outName}/`)) {
      return;
    }
    const next = text.endsWith("\n") || text.length === 0
      ? `${text}${outName}/\n`
      : `${text}\n${outName}/\n`;
    await writeFile(gi, next);
  } catch {
    // no .gitignore — create one with just this entry
    try {
      await writeFile(gi, `${outName}/\n`);
    } catch {
      // ignore
    }
  }
}
