import * as vscode from "vscode";
import { getHostInfo } from "../hostInfo";
import { t } from "../i18n";

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
    );
    // Menu never depends on webview Service Worker
    this.item.command = "elementPicker.showMenu";
    this.refreshTooltip();
    this.setIdle();
    this.item.show();
  }

  private versionSuffix(): string {
    const v = getHostInfo().version;
    return v && v !== "?" ? ` v${v}` : "";
  }

  refreshTooltip(): void {
    const host = getHostInfo();
    this.item.tooltip = `${t("statusBarMenuTooltip")}\n${host.detail}`;
  }

  setIdle(): void {
    this.refreshTooltip();
    this.item.text = `${t("statusBarIdle")}${this.versionSuffix()}`;
    this.item.backgroundColor = undefined;
  }

  setBrowserOpen(selectMode: boolean, cloneMode = false): void {
    this.refreshTooltip();
    const ver = this.versionSuffix();
    if (cloneMode) {
      this.item.text = `${t("statusBarClone")}${ver}`;
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.prominentBackground"
      );
    } else if (selectMode) {
      this.item.text = `${t("statusBarOn")}${ver}`;
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else {
      this.item.text = `${t("statusBarBrowser")}${ver}`;
      this.item.backgroundColor = undefined;
    }
  }

  setClosed(): void {
    this.setIdle();
  }

  dispose(): void {
    this.item.dispose();
  }
}
