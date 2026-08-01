import * as vscode from "vscode";
import { t } from "../i18n";
import type { SavedPick } from "../types";

/** PowerShell-safe single-quoted path (escape ' as ''). */
function psQuote(p: string): string {
  return `'${p.replace(/'/g, "''")}'`;
}

/**
 * Build the block that gets pasted into terminal + clipboard.
 */
export function buildAttachBlock(pick: SavedPick): string {
  const cfg = vscode.workspace.getConfiguration("elementPicker");
  const customPrompt = cfg.get<string>("terminalPrompt", "");
  // Empty custom prompt → localized default
  const prompt =
    customPrompt && customPrompt.trim().length > 0
      ? customPrompt
      : t("defaultTerminalPrompt");

  const isWin = process.platform === "win32";
  const lines: string[] = [];

  if (prompt?.trim()) {
    lines.push(prompt.trim());
  }

  if (isWin) {
    lines.push(`& ${psQuote(pick.contextPath)}`);
    lines.push(`& ${psQuote(pick.imagePath)}`);
  } else {
    lines.push(pick.contextPath);
    lines.push(pick.imagePath);
  }

  lines.push("");
  lines.push(`# Element: ${pick.selector}`);
  lines.push(`# URL: ${pick.url}`);
  lines.push(
    `# Or mention: @.element-picks/latest/context.md @.element-picks/latest/element.png`
  );

  return lines.join("\n");
}

export async function copyToClipboard(pick: SavedPick): Promise<void> {
  const block = buildAttachBlock(pick);
  await vscode.env.clipboard.writeText(block);
}

export async function insertIntoTerminal(pick: SavedPick): Promise<void> {
  const block = buildAttachBlock(pick);
  let terminal = vscode.window.activeTerminal;
  if (!terminal) {
    terminal = vscode.window.createTerminal(t("terminalName"));
  }
  terminal.show(true);
  terminal.sendText(block, false);
}

export async function attachEverywhere(pick: SavedPick): Promise<void> {
  await copyToClipboard(pick);
  await insertIntoTerminal(pick);
}
