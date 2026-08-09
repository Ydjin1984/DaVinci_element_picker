import * as vscode from "vscode";
import { t } from "../i18n";
import type { PanelState } from "./panel";

type ControlKind =
  | "status"
  | "last"
  | "group"
  | "url"
  | "open"
  | "select"
  | "clone"
  | "close"
  | "attach"
  | "copy"
  | "reveal"
  | "language"
  | "editorUi"
  | "reloadWebview"
  | "fixWebview"
  | "startChrome"
  | "menu";

export class ControlItem extends vscode.TreeItem {
  children?: ControlItem[];

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
      children?: ControlItem[];
      id?: string;
    }
  ) {
    super(
      label,
      opts?.children
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.description = opts?.description;
    this.tooltip = opts?.tooltip ?? label;
    if (opts?.id) {
      // Stable id keeps group expansion state across refreshes
      this.id = opts.id;
    }
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
    this.children = opts?.children;
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
    cloneMode: false,
    currentUrl: "",
    lastPick: null,
    status: "Ready",
    statusKind: "idle",
  };

  refresh(state: PanelState): void {
    this.state = state;
    this._onDidChange.fire();
  }

  getTreeItem(element: ControlItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ControlItem): ControlItem[] {
    if (element) {
      return element.children ?? [];
    }

    const s = this.state;

    const browserChildren: ControlItem[] = [
      new ControlItem("open", t("openBrowser"), {
        icon: "globe",
        command: "elementPicker.openBrowser",
        description: s.currentUrl || undefined,
        tooltip: s.currentUrl || t("promptUrl"),
      }),
    ];
    if (s.browserOpen) {
      browserChildren.push(
        new ControlItem("close", t("closeBrowser"), {
          icon: "close",
          command: "elementPicker.closeBrowser",
        })
      );
    }

    const captureChildren: ControlItem[] = [
      new ControlItem(
        "select",
        s.selectMode ? t("selectModeOn") : t("selectMode"),
        {
          icon: s.selectMode ? "target" : "selection",
          command: "elementPicker.toggleSelect",
          description: s.selectMode ? t("onLabel") : undefined,
          tooltip: `${t("selectModeDesc")} (Ctrl+Shift+E)`,
        }
      ),
      new ControlItem(
        "clone",
        s.cloneMode ? t("cloneModeOn") : t("cloneMode"),
        {
          icon: s.cloneMode ? "git-compare" : "copy",
          command: "elementPicker.toggleClone",
          description: s.cloneMode ? t("onLabel") : t("treeFullPackBadge"),
          tooltip: `${t("cloneModeDesc")} (Ctrl+Shift+Alt+C)`,
        }
      ),
    ];

    const lastChildren: ControlItem[] = [];
    if (s.lastPick) {
      lastChildren.push(
        new ControlItem("last", s.lastPick.selector, {
          icon: "check",
          description: s.lastPick.timestamp,
          tooltip: `${s.lastPick.contextPath}\n${s.lastPick.imagePath}`,
          command: "elementPicker.openLastFolder",
        })
      );
    }
    lastChildren.push(
      new ControlItem("attach", t("attachLast"), {
        icon: "terminal",
        command: "elementPicker.attachLast",
      }),
      new ControlItem("copy", t("copyPaths"), {
        icon: "clippy",
        command: "elementPicker.copyLast",
      }),
      new ControlItem("reveal", t("revealFolder"), {
        icon: "folder-opened",
        command: "elementPicker.openLastFolder",
      })
    );

    const advancedChildren: ControlItem[] = [
      new ControlItem("menu", t("actionMenu"), {
        icon: "list-flat",
        command: "elementPicker.showMenu",
        tooltip: t("actionMenuTooltip"),
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
      new ControlItem("fixWebview", t("fixWebview"), {
        icon: "tools",
        command: "elementPicker.fixWebviewCache",
        tooltip: t("fixWebviewTooltip"),
      }),
      new ControlItem("startChrome", t("treeStartChrome"), {
        icon: "debug-start",
        command: "elementPicker.startLocalChrome",
        tooltip: t("treeStartChromeTooltip"),
      }),
    ];

    return [
      new ControlItem(
        "status",
        s.versionBadge ? `DaVinchi ${s.versionBadge}` : "DaVinchi",
        {
          icon: "tag",
          description: s.status || t("statusReady"),
          tooltip: s.versionDetail || s.versionBadge || s.status,
        }
      ),
      new ControlItem("status", s.status || t("statusReady"), {
        icon: s.cloneMode
          ? "git-compare"
          : s.selectMode
            ? "target"
            : s.browserOpen
              ? "globe"
              : "info",
        tooltip: [s.versionDetail, s.status].filter(Boolean).join("\n"),
        description: s.cloneMode
          ? t("badgeCloneOn")
          : s.selectMode
            ? t("badgeSelectOn")
            : s.browserOpen
              ? t("badgeBrowserOpen")
              : s.versionBadge || undefined,
      }),
      new ControlItem("group", t("treeGroupBrowser"), {
        id: "group.browser",
        children: browserChildren,
      }),
      new ControlItem("group", t("treeGroupCapture"), {
        id: "group.capture",
        children: captureChildren,
      }),
      new ControlItem("group", t("sectionLast"), {
        id: "group.last",
        children: lastChildren,
      }),
      new ControlItem("group", t("treeGroupAdvanced"), {
        id: "group.advanced",
        children: advancedChildren,
      }),
    ];
  }
}
