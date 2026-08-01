import * as vscode from "vscode";
import { t } from "../i18n";
import type { PanelState } from "./panel";

type ControlKind =
  | "status"
  | "url"
  | "open"
  | "select"
  | "close"
  | "attach"
  | "copy"
  | "reveal"
  | "language"
  | "editorUi"
  | "reloadWebview"
  | "menu";

export class ControlItem extends vscode.TreeItem {
  constructor(
    public readonly kind: ControlKind,
    label: string,
    opts?: {
      description?: string;
      tooltip?: string;
      icon?: string;
      command?: string;
      args?: unknown[];
      contextValue?: string;
    }
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = opts?.description;
    this.tooltip = opts?.tooltip ?? label;
    if (opts?.icon) {
      this.iconPath = new vscode.ThemeIcon(opts.icon);
    }
    if (opts?.command) {
      this.command = {
        command: opts.command,
        title: label,
        arguments: opts.args,
      };
    }
    this.contextValue = opts?.contextValue ?? kind;
  }
}

/**
 * Native sidebar tree — no Service Worker, survives webview host failures.
 * Primary durable UI for DaVinchi.
 */
export class ControlsTreeProvider
  implements vscode.TreeDataProvider<ControlItem>
{
  public static readonly viewId = "elementPicker.controls";

  private readonly _onDidChange = new vscode.EventEmitter<
    ControlItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private state: PanelState = {
    browserOpen: false,
    selectMode: false,
    currentUrl: "",
    lastPick: null,
    status: "Ready",
  };

  refresh(state: PanelState): void {
    this.state = state;
    this._onDidChange.fire();
  }

  getTreeItem(element: ControlItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ControlItem[] {
    const s = this.state;
    const items: ControlItem[] = [
      new ControlItem("status", s.status || t("statusReady"), {
        icon: s.selectMode ? "target" : s.browserOpen ? "globe" : "info",
        tooltip: s.status,
        description: s.selectMode
          ? t("badgeSelectOn")
          : s.browserOpen
            ? t("badgeBrowserOpen")
            : undefined,
      }),
      new ControlItem("url", s.currentUrl || t("urlLabel"), {
        icon: "link",
        description: t("urlLabel"),
        tooltip: s.currentUrl || t("promptUrl"),
        command: "elementPicker.openBrowser",
      }),
      new ControlItem("menu", t("actionMenu"), {
        icon: "list-flat",
        command: "elementPicker.showMenu",
        tooltip: t("actionMenuTooltip"),
      }),
      new ControlItem("open", t("openBrowser"), {
        icon: "globe",
        command: "elementPicker.openBrowser",
      }),
      new ControlItem(
        "select",
        s.selectMode ? t("selectModeOn") : t("selectMode"),
        {
          icon: s.selectMode ? "target" : "selection",
          command: "elementPicker.toggleSelect",
          description: s.selectMode ? "ON" : undefined,
        }
      ),
      new ControlItem("close", t("closeBrowser"), {
        icon: "close",
        command: "elementPicker.closeBrowser",
      }),
      new ControlItem("attach", t("attachLast"), {
        icon: "terminal",
        command: "elementPicker.attachLast",
        description: s.lastPick?.selector,
      }),
      new ControlItem("copy", t("copyPaths"), {
        icon: "clippy",
        command: "elementPicker.copyLast",
      }),
      new ControlItem("reveal", t("revealFolder"), {
        icon: "folder-opened",
        command: "elementPicker.openLastFolder",
      }),
      new ControlItem("language", t("languageLabel"), {
        icon: "globe",
        command: "elementPicker.selectLanguage",
      }),
      new ControlItem("editorUi", t("openEditorUi"), {
        icon: "window",
        command: "elementPicker.openEditorPanel",
        tooltip: t("openEditorUiTooltip"),
      }),
      new ControlItem("reloadWebview", t("reloadWebview"), {
        icon: "refresh",
        command: "elementPicker.reloadWebview",
        tooltip: t("reloadWebviewTooltip"),
      }),
    ];

    if (s.lastPick) {
      items.splice(
        1,
        0,
        new ControlItem(
          "status",
          `${t("lastLabel")} ${s.lastPick.selector}`,
          {
            icon: "check",
            description: s.lastPick.timestamp,
            tooltip: `${s.lastPick.contextPath}\n${s.lastPick.imagePath}`,
            command: "elementPicker.openLastFolder",
          }
        )
      );
    }

    return items;
  }
}
