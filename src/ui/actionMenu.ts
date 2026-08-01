import * as vscode from "vscode";
import { t } from "../i18n";
import type { PanelState } from "./panel";

/**
 * Native QuickPick control surface — never depends on webview Service Worker.
 */
export async function showActionMenu(state: PanelState): Promise<void> {
  type Item = vscode.QuickPickItem & { command?: string };

  const items: Item[] = [
    {
      label: `$(info) ${state.status || t("statusReady")}`,
      description: state.selectMode
        ? t("badgeSelectOn")
        : state.browserOpen
          ? t("badgeBrowserOpen")
          : undefined,
      detail: state.currentUrl || undefined,
    },
    {
      label: `$(globe) ${t("openBrowser")}`,
      command: "elementPicker.openBrowser",
    },
    {
      label: `$(${state.selectMode ? "target" : "selection"}) ${
        state.selectMode ? t("selectModeOn") : t("selectMode")
      }`,
      description: "Ctrl+Shift+E",
      command: "elementPicker.toggleSelect",
    },
    {
      label: `$(close) ${t("closeBrowser")}`,
      command: "elementPicker.closeBrowser",
    },
    {
      label: `$(terminal) ${t("attachLast")}`,
      description: state.lastPick?.selector,
      command: "elementPicker.attachLast",
    },
    {
      label: `$(clippy) ${t("copyPaths")}`,
      command: "elementPicker.copyLast",
    },
    {
      label: `$(folder-opened) ${t("revealFolder")}`,
      command: "elementPicker.openLastFolder",
    },
    {
      label: `$(globe) ${t("languageLabel")}`,
      command: "elementPicker.selectLanguage",
    },
    {
      label: `$(window) ${t("openEditorUi")}`,
      detail: t("openEditorUiTooltip"),
      command: "elementPicker.openEditorPanel",
    },
    {
      label: `$(refresh) ${t("reloadWebview")}`,
      detail: t("reloadWebviewTooltip"),
      command: "elementPicker.reloadWebview",
    },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: t("panelTitle"),
    placeHolder: t("actionMenuPlaceholder"),
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (picked?.command) {
    await vscode.commands.executeCommand(picked.command);
  }
}
