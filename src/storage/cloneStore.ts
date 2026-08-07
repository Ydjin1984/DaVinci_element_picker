import * as path from "path";
import * as vscode from "vscode";
import {
  buildAgentMarkdown,
  buildCloneMarkdown,
  buildCloneMeta,
  buildComputedJson,
} from "../capture/cloneBuilder";
import { buildStandalonePreviewHtml } from "../capture/standalonePreview";
import { buildContextMarkdown } from "../capture/contextBuilder";
import type {
  ElementClonePayload,
  ElementPickPayload,
  SavedCloneAsset,
  SavedPick,
} from "../types";
import { createZipBuffer, type ZipEntry } from "./zipArchive";
import { getOutputDirName } from "./pickStore";

/** Extra clone pack outputs controlled by settings. */
export type ClonePackExtras = "none" | "previewHtml" | "zip" | "both";

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
}

function getMaxHtmlBytes(): number {
  return (
    vscode.workspace
      .getConfiguration("elementPicker")
      .get<number>("maxHtmlBytes", 100000) || 100000
  );
}

export function getClonePackExtras(): ClonePackExtras {
  const raw = vscode.workspace
    .getConfiguration("elementPicker")
    .get<string>("clonePackExtras", "both");
  if (
    raw === "none" ||
    raw === "previewHtml" ||
    raw === "zip" ||
    raw === "both"
  ) {
    return raw;
  }
  return "both";
}

function wantPreview(extras: ClonePackExtras): boolean {
  return extras === "previewHtml" || extras === "both";
}

function wantZip(extras: ClonePackExtras): boolean {
  return extras === "zip" || extras === "both";
}

function workspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function ensureDir(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch {
    /* may already exist */
  }
}

async function writeFile(
  uri: vscode.Uri,
  data: Uint8Array | string
): Promise<void> {
  const buf =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  await vscode.workspace.fs.writeFile(uri, buf);
}

function extFromContentType(ct: string | undefined, url: string): string {
  const lower = (ct || "").toLowerCase();
  if (lower.includes("png")) return ".png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg";
  if (lower.includes("webp")) return ".webp";
  if (lower.includes("gif")) return ".gif";
  if (lower.includes("svg")) return ".svg";
  if (lower.includes("woff2")) return ".woff2";
  if (lower.includes("woff")) return ".woff";
  if (lower.includes("ttf") || lower.includes("truetype")) return ".ttf";
  if (lower.includes("otf") || lower.includes("opentype")) return ".otf";
  if (lower.includes("css")) return ".css";
  if (lower.includes("mp4")) return ".mp4";
  if (lower.includes("webm")) return ".webm";
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname);
    const m = base.match(/(\.[a-zA-Z0-9]{2,5})$/);
    if (m) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  if (url.startsWith("data:image/svg")) return ".svg";
  if (url.startsWith("data:image/png")) return ".png";
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg"))
    return ".jpg";
  if (url.startsWith("data:image/webp")) return ".webp";
  if (url.startsWith("data:font/woff2") || url.includes("woff2")) return ".woff2";
  return ".bin";
}

function decodeDataUrl(
  dataUrl: string
): { bytes: Uint8Array; contentType?: string } | null {
  // No regex here: a backtracking pattern hangs on adversarial inputs (ReDoS)
  if (!dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const data = dataUrl.slice(comma + 1);
  if (!data) return null;
  const metaParts = dataUrl.slice(5, comma).split(";");
  const contentType = metaParts[0].includes("/") ? metaParts[0] : undefined;
  const isBase64 = metaParts.includes("base64");
  try {
    if (isBase64) {
      const buf = Buffer.from(data, "base64");
      return { bytes: new Uint8Array(buf), contentType };
    }
    const decoded = Buffer.from(decodeURIComponent(data), "utf8");
    return { bytes: new Uint8Array(decoded), contentType };
  } catch {
    return null;
  }
}

export type AssetDownloader = (
  url: string
) => Promise<{ bytes: Uint8Array; contentType?: string } | null>;

export interface CloneScreenshots {
  elementPng: Uint8Array;
  pagePng: Uint8Array;
  parentPng?: Uint8Array | null;
}

/**
 * Save a full clone pack under .element-picks/<ts>/ (+ clone/ subfolder).
 */
export async function saveClonePack(
  payload: ElementClonePayload,
  shots: CloneScreenshots,
  downloadAsset: AssetDownloader
): Promise<SavedPick> {
  const root = workspaceRoot();
  if (!root) {
    throw new Error("Open a workspace folder to save element clones.");
  }

  const outName = getOutputDirName();
  const ts = stamp();
  const base = vscode.Uri.joinPath(root, outName);
  const folder = vscode.Uri.joinPath(base, ts);
  const latest = vscode.Uri.joinPath(base, "latest");
  const cloneDir = vscode.Uri.joinPath(folder, "clone");
  const assetsDir = vscode.Uri.joinPath(cloneDir, "assets");
  const latestClone = vscode.Uri.joinPath(latest, "clone");
  const latestAssets = vscode.Uri.joinPath(latestClone, "assets");

  await ensureDir(base);
  await ensureDir(folder);
  // latest/ uses positional asset names (img-001.*), so stale files from a
  // previous capture would mix in — wipe it before writing the new capture
  try {
    await vscode.workspace.fs.delete(latest, {
      recursive: true,
      useTrash: false,
    });
  } catch {
    /* may not exist */
  }
  await ensureDir(latest);
  await ensureDir(cloneDir);
  await ensureDir(assetsDir);
  await ensureDir(latestClone);
  await ensureDir(latestAssets);

  // Light context.md (compatible with normal picks)
  const lightPayload: ElementPickPayload = {
    ...payload,
    outerHTML: payload.subtreeHTML || payload.outerHTML,
    cssText: payload.deepCssText || payload.cssText,
    cssVariables: payload.deepCssVariables || payload.cssVariables,
  };
  const markdown = buildContextMarkdown(lightPayload, getMaxHtmlBytes());
  const contextUri = vscode.Uri.joinPath(folder, "context.md");
  const imageUri = vscode.Uri.joinPath(folder, "element.png");
  await writeFile(contextUri, markdown);
  await writeFile(imageUri, shots.elementPng);
  await writeFile(vscode.Uri.joinPath(latest, "context.md"), markdown);
  await writeFile(vscode.Uri.joinPath(latest, "element.png"), shots.elementPng);

  // Clone screenshots
  await writeFile(vscode.Uri.joinPath(cloneDir, "element.png"), shots.elementPng);
  await writeFile(vscode.Uri.joinPath(cloneDir, "page.png"), shots.pagePng);
  await writeFile(
    vscode.Uri.joinPath(latestClone, "element.png"),
    shots.elementPng
  );
  await writeFile(vscode.Uri.joinPath(latestClone, "page.png"), shots.pagePng);
  if (shots.parentPng && shots.parentPng.byteLength > 0) {
    await writeFile(
      vscode.Uri.joinPath(cloneDir, "parent.png"),
      shots.parentPng
    );
    await writeFile(
      vscode.Uri.joinPath(latestClone, "parent.png"),
      shots.parentPng
    );
  }

  // HTML + CSS
  const subtreeHtml = payload.subtreeHTML || payload.outerHTML || "";
  const stylesCss = [
    "/* DaVinchi clone styles — matched rules, deep CSS, keyframes, font-face */",
    "",
    payload.deepCssText || payload.cssText || "",
    "",
    "/* === @font-face === */",
    payload.fontFaceCss || "",
    "",
    "/* === @keyframes === */",
    payload.keyframesCss || "",
  ].join("\n");

  await writeFile(vscode.Uri.joinPath(cloneDir, "subtree.html"), subtreeHtml);
  await writeFile(vscode.Uri.joinPath(cloneDir, "styles.css"), stylesCss);
  await writeFile(
    vscode.Uri.joinPath(latestClone, "subtree.html"),
    subtreeHtml
  );
  await writeFile(vscode.Uri.joinPath(latestClone, "styles.css"), stylesCss);

  // Download assets
  const savedAssets: SavedCloneAsset[] = [];
  const seenUrls = new Set<string>();
  const maxAssets = 48;
  const maxBytesEach = 6 * 1024 * 1024;

  // Prefer unique absolute URLs; also handle canvas data URLs from payload
  const queueList = [...(payload.assets || [])];
  for (const c of payload.canvasDataUrls || []) {
    if (c.dataUrl?.startsWith("data:")) {
      queueList.push({
        kind: "img",
        url: c.dataUrl,
        note: "canvas snapshot",
        selector: c.selector,
      });
    }
  }

  let idx = 0;
  let savedOk = 0;
  for (const ref of queueList) {
    // Cap successful downloads only — failed entries must not eat the budget
    if (savedOk >= maxAssets) break;
    const url = (ref.url || "").trim();
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    // Skip enormous data URLs early
    if (url.startsWith("data:") && url.length > maxBytesEach * 1.4) {
      savedAssets.push({
        kind: ref.kind,
        originalUrl: url.slice(0, 80) + "…",
        localPath: "",
        localRel: "",
        bytes: 0,
        ok: false,
        error: "data URL too large",
        note: ref.note,
        selector: ref.selector,
      });
      continue;
    }
    idx += 1;
    const pad = String(idx).padStart(3, "0");

    try {
      let bytes: Uint8Array | null = null;
      let contentType: string | undefined;

      if (url.startsWith("data:")) {
        const decoded = decodeDataUrl(url);
        if (decoded) {
          bytes = decoded.bytes;
          contentType = decoded.contentType;
        }
      } else if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("blob:")
      ) {
        if (url.startsWith("blob:")) {
          savedAssets.push({
            kind: ref.kind,
            originalUrl: url,
            localPath: "",
            localRel: "",
            bytes: 0,
            ok: false,
            error: "blob: URLs cannot be re-fetched from host",
            note: ref.note,
            selector: ref.selector,
          });
          continue;
        }
        const got = await downloadAsset(url);
        if (got) {
          bytes = got.bytes;
          contentType = got.contentType;
        }
      } else {
        // relative — resolve against page URL
        try {
          const abs = new URL(url, payload.url).href;
          if (seenUrls.has(abs)) continue;
          seenUrls.add(abs);
          const got = await downloadAsset(abs);
          if (got) {
            bytes = got.bytes;
            contentType = got.contentType;
          }
        } catch {
          /* ignore */
        }
      }

      if (!bytes || bytes.byteLength === 0) {
        savedAssets.push({
          kind: ref.kind,
          originalUrl: url.startsWith("data:") ? url.slice(0, 64) + "…" : url,
          localPath: "",
          localRel: "",
          bytes: 0,
          ok: false,
          error: "download failed or empty",
          note: ref.note,
          selector: ref.selector,
        });
        continue;
      }

      if (bytes.byteLength > maxBytesEach) {
        savedAssets.push({
          kind: ref.kind,
          originalUrl: url.startsWith("data:") ? url.slice(0, 64) + "…" : url,
          localPath: "",
          localRel: "",
          bytes: bytes.byteLength,
          ok: false,
          error: `exceeds ${maxBytesEach} bytes`,
          note: ref.note,
          selector: ref.selector,
        });
        continue;
      }

      const ext = extFromContentType(contentType, url);
      const fileName = `${ref.kind}-${pad}${ext}`;
      const assetUri = vscode.Uri.joinPath(assetsDir, fileName);
      await writeFile(assetUri, bytes);
      await writeFile(vscode.Uri.joinPath(latestAssets, fileName), bytes);

      savedAssets.push({
        kind: ref.kind,
        originalUrl: url.startsWith("data:")
          ? `data:(${contentType || "unknown"}; ${bytes.byteLength} bytes)`
          : url,
        localPath: assetUri.fsPath,
        localRel: `assets/${fileName}`,
        bytes: bytes.byteLength,
        contentType,
        ok: true,
        note: ref.note,
        selector: ref.selector,
      });
      savedOk += 1;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      savedAssets.push({
        kind: ref.kind,
        originalUrl: url.startsWith("data:") ? "data:…" : url,
        localPath: "",
        localRel: "",
        bytes: 0,
        ok: false,
        error: err,
        note: ref.note,
        selector: ref.selector,
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: savedAssets.length,
    assets: savedAssets,
  };
  await writeFile(
    vscode.Uri.joinPath(assetsDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  await writeFile(
    vscode.Uri.joinPath(latestAssets, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  const computed = buildComputedJson(payload);
  const meta = buildCloneMeta(payload);
  const fontsJson = payload.fonts || [];

  await writeFile(
    vscode.Uri.joinPath(cloneDir, "computed.json"),
    JSON.stringify(computed, null, 2)
  );
  await writeFile(
    vscode.Uri.joinPath(cloneDir, "meta.json"),
    JSON.stringify(meta, null, 2)
  );
  await writeFile(
    vscode.Uri.joinPath(cloneDir, "fonts.json"),
    JSON.stringify(fontsJson, null, 2)
  );
  await writeFile(
    vscode.Uri.joinPath(latestClone, "computed.json"),
    JSON.stringify(computed, null, 2)
  );
  await writeFile(
    vscode.Uri.joinPath(latestClone, "meta.json"),
    JSON.stringify(meta, null, 2)
  );
  await writeFile(
    vscode.Uri.joinPath(latestClone, "fonts.json"),
    JSON.stringify(fontsJson, null, 2)
  );

  // If any inline SVGs, dump them
  const inlineSvgNames: string[] = [];
  if (payload.inlineSvgs?.length) {
    for (let i = 0; i < payload.inlineSvgs.length; i++) {
      const name = `inline-${String(i + 1).padStart(2, "0")}.svg`;
      // wrap if needed
      let svg = payload.inlineSvgs[i];
      if (!/^\s*<svg/i.test(svg)) {
        svg = `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
      }
      await writeFile(vscode.Uri.joinPath(cloneDir, name), svg);
      await writeFile(vscode.Uri.joinPath(latestClone, name), svg);
      inlineSvgNames.push(name);
    }
  }

  const extras = getClonePackExtras();
  let previewHtmlPath: string | undefined;
  let zipPath: string | undefined;

  // Standalone preview.html (self-contained)
  if (wantPreview(extras)) {
    const assetBytes = new Map<string, Uint8Array>();
    for (const a of savedAssets) {
      if (!a.ok || !a.localRel || !a.localPath) continue;
      try {
        const uri = vscode.Uri.file(a.localPath);
        const data = await vscode.workspace.fs.readFile(uri);
        assetBytes.set(a.localRel, data);
      } catch {
        /* skip missing */
      }
    }

    const previewHtml = buildStandalonePreviewHtml({
      payload,
      stylesCss,
      subtreeHtml,
      elementPng: shots.elementPng,
      pagePng: shots.pagePng,
      parentPng: shots.parentPng,
      assets: savedAssets,
      assetBytes,
    });
    await writeFile(vscode.Uri.joinPath(cloneDir, "preview.html"), previewHtml);
    await writeFile(
      vscode.Uri.joinPath(latestClone, "preview.html"),
      previewHtml
    );
    previewHtmlPath = vscode.Uri.joinPath(cloneDir, "preview.html").fsPath;
  }

  const pick: SavedPick = {
    folderUri: folder,
    contextUri,
    imageUri,
    contextPath: contextUri.fsPath,
    imagePath: imageUri.fsPath,
    selector: payload.selector,
    url: payload.url,
    timestamp: ts,
    isClone: true,
    cloneDirPath: cloneDir.fsPath,
    cloneMdPath: vscode.Uri.joinPath(cloneDir, "CLONE.md").fsPath,
    agentMdPath: vscode.Uri.joinPath(cloneDir, "AGENT.md").fsPath,
    pageImagePath: vscode.Uri.joinPath(cloneDir, "page.png").fsPath,
    parentImagePath: shots.parentPng
      ? vscode.Uri.joinPath(cloneDir, "parent.png").fsPath
      : undefined,
    assetsDirPath: assetsDir.fsPath,
    previewHtmlPath,
  };

  // Zip path is known up front so the markdown can reference it and the
  // archive is built exactly once with the final markdown inside
  const zipUri = vscode.Uri.joinPath(folder, "clone.zip");
  if (wantZip(extras)) {
    zipPath = zipUri.fsPath;
    pick.zipPath = zipPath;
  }

  const toRel = (uri: vscode.Uri): string =>
    path.relative(root.fsPath, uri.fsPath).replace(/\\/g, "/");

  const cloneMd = buildCloneMarkdown(payload, savedAssets, {
    elementPng: toRel(vscode.Uri.joinPath(cloneDir, "element.png")),
    pagePng: toRel(vscode.Uri.joinPath(cloneDir, "page.png")),
    parentPng: pick.parentImagePath
      ? toRel(vscode.Uri.joinPath(cloneDir, "parent.png"))
      : undefined,
    subtreeHtml: toRel(vscode.Uri.joinPath(cloneDir, "subtree.html")),
    stylesCss: toRel(vscode.Uri.joinPath(cloneDir, "styles.css")),
    assetsDir: toRel(assetsDir),
    previewHtml: previewHtmlPath
      ? toRel(vscode.Uri.joinPath(cloneDir, "preview.html"))
      : undefined,
    zip: zipPath ? toRel(zipUri) : undefined,
  });
  const agentMd = buildAgentMarkdown(payload, pick);

  await writeFile(vscode.Uri.joinPath(cloneDir, "CLONE.md"), cloneMd);
  await writeFile(vscode.Uri.joinPath(cloneDir, "AGENT.md"), agentMd);
  await writeFile(vscode.Uri.joinPath(latestClone, "CLONE.md"), cloneMd);
  await writeFile(vscode.Uri.joinPath(latestClone, "AGENT.md"), agentMd);

  // Zip archive of the full clone/ folder (+ light pick files at root of zip)
  if (wantZip(extras)) {
    const entries: ZipEntry[] = [];

    const pushFile = async (
      uri: vscode.Uri,
      archiveName: string
    ): Promise<void> => {
      try {
        const data = await vscode.workspace.fs.readFile(uri);
        entries.push({ name: archiveName, data });
      } catch {
        /* skip */
      }
    };

    // clone/* files
    await pushFile(vscode.Uri.joinPath(cloneDir, "CLONE.md"), "clone/CLONE.md");
    await pushFile(vscode.Uri.joinPath(cloneDir, "AGENT.md"), "clone/AGENT.md");
    await pushFile(
      vscode.Uri.joinPath(cloneDir, "element.png"),
      "clone/element.png"
    );
    await pushFile(vscode.Uri.joinPath(cloneDir, "page.png"), "clone/page.png");
    if (shots.parentPng && shots.parentPng.byteLength > 0) {
      await pushFile(
        vscode.Uri.joinPath(cloneDir, "parent.png"),
        "clone/parent.png"
      );
    }
    await pushFile(
      vscode.Uri.joinPath(cloneDir, "subtree.html"),
      "clone/subtree.html"
    );
    await pushFile(
      vscode.Uri.joinPath(cloneDir, "styles.css"),
      "clone/styles.css"
    );
    await pushFile(
      vscode.Uri.joinPath(cloneDir, "computed.json"),
      "clone/computed.json"
    );
    await pushFile(vscode.Uri.joinPath(cloneDir, "meta.json"), "clone/meta.json");
    await pushFile(
      vscode.Uri.joinPath(cloneDir, "fonts.json"),
      "clone/fonts.json"
    );
    if (previewHtmlPath) {
      await pushFile(
        vscode.Uri.joinPath(cloneDir, "preview.html"),
        "clone/preview.html"
      );
    }
    for (const name of inlineSvgNames) {
      await pushFile(vscode.Uri.joinPath(cloneDir, name), `clone/${name}`);
    }
    await pushFile(
      vscode.Uri.joinPath(assetsDir, "manifest.json"),
      "clone/assets/manifest.json"
    );
    for (const a of savedAssets) {
      if (!a.ok || !a.localRel) continue;
      await pushFile(
        vscode.Uri.joinPath(cloneDir, a.localRel),
        `clone/${a.localRel.replace(/\\/g, "/")}`
      );
    }

    // Also include light pick at archive root
    await pushFile(contextUri, "context.md");
    await pushFile(imageUri, "element.png");

    const zipBytes = createZipBuffer(entries);
    const latestZipUri = vscode.Uri.joinPath(latest, "clone.zip");
    await writeFile(zipUri, zipBytes);
    await writeFile(latestZipUri, zipBytes);
  }

  return pick;
}
