import * as vscode from "vscode";
import { t } from "../i18n";
import { getOutputDirName } from "../storage/pickStore";
import type { SavedPick } from "../types";

/**
 * Shell-neutral quoting. The block is a prompt for a terminal AI agent, not a
 * command, so it must read identically in PowerShell, cmd, bash and zsh —
 * including paths with spaces or non-ASCII characters. No call operators.
 */
function quotePath(p: string): string {
  return `"${p}"`;
}

/** Output dir for @mention hints (sanitized, forward slashes). */
function outputDirPosix(): string {
  return getOutputDirName().replace(/\\/g, "/");
}

/**
 * Build the block that gets pasted into terminal + clipboard.
 */
export function buildAttachBlock(pick: SavedPick): string {
  const cfg = vscode.workspace.getConfiguration("elementPicker");
  const customPrompt = cfg.get<string>("terminalPrompt", "");
  // Empty custom prompt → localized default (clone gets a richer default)
  const prompt =
    customPrompt && customPrompt.trim().length > 0
      ? customPrompt
      : pick.isClone
        ? t("defaultCloneTerminalPrompt")
        : t("defaultTerminalPrompt");

  const lines: string[] = [];

  if (prompt?.trim()) {
    lines.push(prompt.trim());
  }

  const paths: Array<string | undefined> = [pick.contextPath, pick.imagePath];
  if (pick.isClone) {
    paths.push(
      pick.agentMdPath,
      pick.cloneMdPath,
      pick.previewHtmlPath,
      pick.zipPath,
      pick.pageImagePath,
      pick.parentImagePath
    );
  }
  for (const p of paths) {
    if (p) lines.push(quotePath(p));
  }

  lines.push("");
  lines.push(`# Element: ${pick.selector}${pick.isClone ? " [CLONE]" : ""}`);
  lines.push(`# URL: ${pick.url}`);
  const dir = outputDirPosix();
  if (pick.isClone) {
    const mentions = [
      `@${dir}/latest/clone/AGENT.md`,
      `@${dir}/latest/clone/CLONE.md`,
      `@${dir}/latest/clone/element.png`,
      `@${dir}/latest/clone/page.png`,
    ];
    if (pick.previewHtmlPath) {
      mentions.push(`@${dir}/latest/clone/preview.html`);
    }
    if (pick.zipPath) {
      mentions.push(`@${dir}/latest/clone.zip`);
    }
    lines.push(`# Full clone: ${mentions.join(" ")}`);
  } else {
    lines.push(
      `# Or mention: @${dir}/latest/context.md @${dir}/latest/element.png`
    );
  }

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
