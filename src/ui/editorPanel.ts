import * as vscode from "vscode";
import type { ElementPickerPanelProvider, PanelState } from "./panel";

/**
 * Editor-area webview panel — separate host lifecycle from the sidebar view.
 * Often works when the activity-bar webview Service Worker is stuck.
 */
export class EditorControlPanel {
  private panel: vscode.WebviewPanel | undefined;
  /** Kept separately so dispose can unbind without reading a disposed panel.webview. */
  private panelWebview: vscode.Webview | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly provider: ElementPickerPanelProvider
  ) {}

  show(state: PanelState): void {
    if (this.panel && this.panelWebview) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
      this.provider.bindExternalWebview(this.panelWebview, state);
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
    this.panelWebview = this.panel.webview;

    this.provider.bindExternalWebview(this.panelWebview, state);

    this.panel.onDidDispose(() => {
      const wv = this.panelWebview;
      this.panel = undefined;
      this.panelWebview = undefined;
      // Use the pre-captured webview reference — panel.webview throws after dispose
      this.provider.unbindExternalWebview(wv);
    });
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    this.panelWebview = undefined;
  }
}
