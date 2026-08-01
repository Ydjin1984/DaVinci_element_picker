import * as vscode from "vscode";
import type { ElementPickerPanelProvider, PanelState } from "./panel";

/**
 * Editor-area webview panel — separate host lifecycle from the sidebar view.
 * Often works when the activity-bar webview Service Worker is stuck.
 */
export class EditorControlPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly provider: ElementPickerPanelProvider
  ) {}

  show(state: PanelState): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      this.provider.bindExternalWebview(this.panel.webview, state);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "elementPicker.editorPanel",
      "DaVinchi",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.provider.bindExternalWebview(this.panel.webview, state);

    this.panel.onDidDispose(() => {
      this.provider.unbindExternalWebview(this.panel?.webview);
      this.panel = undefined;
    });
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }
}
