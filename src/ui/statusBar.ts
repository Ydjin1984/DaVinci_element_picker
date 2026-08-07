import * as vscode from "vscode";
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

  refreshTooltip(): void {
    this.item.tooltip = t("statusBarMenuTooltip");
  }

  setIdle(): void {
    this.refreshTooltip();
    this.item.text = t("statusBarIdle");
    this.item.backgroundColor = undefined;
  }

  setBrowserOpen(selectMode: boolean, cloneMode = false): void {
    this.refreshTooltip();
    if (cloneMode) {
      this.item.text = t("statusBarClone");
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.prominentBackground"
      );
    } else if (selectMode) {
      this.item.text = t("statusBarOn");
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else {
      this.item.text = t("statusBarBrowser");
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
