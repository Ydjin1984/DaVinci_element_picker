import * as vscode from "vscode";
import { t } from "../i18n";
import type { PanelState } from "./panel";

/**
 * Native QuickPick control surface — never depends on webview Service Worker.
 */
export async function showActionMenu(state: PanelState): Promise<void> {
  type Item = vscode.QuickPickItem & { command?: string };

  const separator = (label: string): Item => ({
    label,
    kind: vscode.QuickPickItemKind.Separator,
  });

  const items: Item[] = [
    {
      label: `$(info) ${state.status || t("statusReady")}`,
      description: state.cloneMode
        ? t("badgeCloneOn")
        : state.selectMode
          ? t("badgeSelectOn")
          : state.browserOpen
            ? t("badgeBrowserOpen")
            : undefined,
      detail: state.currentUrl || undefined,
    },
    separator(t("treeGroupBrowser")),
    {
      label: `$(globe) ${t("openBrowser")}`,
      command: "elementPicker.openBrowser",
    },
    {
      label: `$(close) ${t("closeBrowser")}`,
      command: "elementPicker.closeBrowser",
    },
    separator(t("treeGroupCapture")),
    {
      label: `$(${state.selectMode ? "target" : "selection"}) ${
        state.selectMode ? t("selectModeOn") : t("selectMode")
      }`,
      description: "Ctrl+Shift+E",
      detail: t("selectModeDesc"),
      command: "elementPicker.toggleSelect",
    },
    {
      label: `$(${state.cloneMode ? "git-compare" : "copy"}) ${
        state.cloneMode ? t("cloneModeOn") : t("cloneMode")
      }`,
      description: "Ctrl+Shift+Alt+C",
      detail: t("cloneModeDesc"),
      command: "elementPicker.toggleClone",
    },
    separator(t("sectionLast")),
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
    separator(t("treeGroupAdvanced")),
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
    {
      label: `$(debug-start) ${t("treeStartChrome")}`,
      detail: t("treeStartChromeTooltip"),
      command: "elementPicker.startLocalChrome",
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
