import * as vscode from "vscode";
import {
  getLanguageOptions,
  getLocale,
  getUiStrings,
  setLocale,
  type Locale,
} from "../i18n";
import {
  getCloneOptions,
  isCloneOptionKey,
  updateCloneOption,
} from "../storage/cloneOptions";
import type { SavedPick } from "../types";

export type PanelActions = {
  openBrowser: (url: string) => Promise<void>;
  toggleSelect: () => Promise<boolean>;
  toggleClone: () => Promise<boolean>;
  closeBrowser: () => Promise<void>;
  attachLast: () => Promise<void>;
  copyLast: () => Promise<void>;
  openLastFolder: () => Promise<void>;
  getDefaultUrl: () => string;
  getState: () => PanelState;
  onLanguageChanged?: (locale: Locale) => void;
};

/** Visual tone of the status line (dot color + animation). */
export type StatusKind = "idle" | "ok" | "busy" | "error";

export interface PanelState {
  browserOpen: boolean;
  selectMode: boolean;
  cloneMode: boolean;
  currentUrl: string;
  lastPick: SavedPick | null;
  status: string;
  statusKind?: StatusKind;
}

export class ElementPickerPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "elementPicker.panel";

  private view?: vscode.WebviewView;
  /** Extra webviews (e.g. editor panel) that share the same HTML protocol. */
  private externalWebviews = new Set<vscode.Webview>();
  private messageDisposables = new Map<vscode.Webview, vscode.Disposable>();
  private actions: PanelActions;
  private state: PanelState = {
    browserOpen: false,
    selectMode: false,
    cloneMode: false,
    currentUrl: "",
    lastPick: null,
    status: "Ready",
    statusKind: "idle",
  };

  constructor(
    private readonly extensionUri: vscode.Uri,
    actions: PanelActions
  ) {
    this.actions = actions;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Fresh document whenever the view becomes visible again.
    // retainContextWhenHidden=false + remount fights stale Service Worker state.
    this.mountWebview(webviewView.webview);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.mountWebview(webviewView.webview);
      }
    });

    webviewView.onDidDispose(() => {
      const d = this.messageDisposables.get(webviewView.webview);
      d?.dispose();
      this.messageDisposables.delete(webviewView.webview);
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });

    const s = this.actions.getState();
    this.state = { ...this.state, ...s };
    this.postState();
  }

  /**
   * Bind an editor WebviewPanel (separate host lifecycle from sidebar).
   */
  bindExternalWebview(webview: vscode.Webview, state?: PanelState): void {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.externalWebviews.add(webview);
    if (state) {
      this.state = { ...this.state, ...state };
    }
    this.mountWebview(webview);
    this.postState();
  }

  unbindExternalWebview(webview?: vscode.Webview): void {
    if (!webview) return;
    this.externalWebviews.delete(webview);
    const d = this.messageDisposables.get(webview);
    d?.dispose();
    this.messageDisposables.delete(webview);
  }

  /** Force remount of sidebar + external webviews (recovery command). */
  forceRemount(): void {
    if (this.view) {
      try {
        this.mountWebview(this.view.webview);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        void vscode.window.showWarningMessage(
          formatUi(getUiStrings().errPrefix, err)
        );
      }
    }
    for (const w of this.externalWebviews) {
      try {
        this.mountWebview(w);
      } catch {
        /* ignore individual failures */
      }
    }
    this.postState();
  }

  updateState(partial: Partial<PanelState>): void {
    this.state = { ...this.state, ...partial };
    this.postState();
  }

  /** Force re-push i18n strings after language change. */
  refreshI18n(): void {
    this.postState();
  }

  private mountWebview(webview: vscode.Webview): void {
    // Re-bind message handler once per webview instance
    const prev = this.messageDisposables.get(webview);
    prev?.dispose();
    const sub = webview.onDidReceiveMessage((msg) => {
      void this.handleMessage(msg);
    });
    this.messageDisposables.set(webview, sub);

    // Assigning html creates a new document — recovery path for bad SW state
    webview.html = this.getHtml(webview);
  }

  private async handleMessage(msg: {
    type?: string;
    url?: string;
    language?: string;
    key?: string;
    value?: boolean;
  }): Promise<void> {
    try {
      switch (msg?.type) {
        case "open": {
          // Empty → extension prompts for any user URL (no site presets)
          const url = String(msg.url || "").trim();
          await this.actions.openBrowser(url);
          break;
        }
        case "toggleSelect":
          await this.actions.toggleSelect();
          break;
        case "toggleClone":
          await this.actions.toggleClone();
          break;
        case "close":
          await this.actions.closeBrowser();
          break;
        case "attach":
          await this.actions.attachLast();
          break;
        case "copy":
          await this.actions.copyLast();
          break;
        case "reveal":
          await this.actions.openLastFolder();
          break;
        case "setCloneOption": {
          const key = String(msg.key || "");
          if (isCloneOptionKey(key)) {
            // Persisted to User settings; the configuration listener in
            // extension.ts re-syncs UI and pushes options into the page
            await updateCloneOption(key, !!msg.value);
            this.postState();
          }
          break;
        }
        case "setLanguage": {
          const code = String(msg.language || "en") as Locale;
          await setLocale(code);
          this.actions.onLanguageChanged?.(getLocale());
          this.postState();
          break;
        }
        case "ready":
          this.postState();
          break;
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const strings = getUiStrings();
      this.updateState({
        status: formatUi(strings.statusError, err),
        statusKind: "error",
      });
      void vscode.window.showErrorMessage(formatUi(strings.errPrefix, err));
    }
  }

  private postState(): void {
    const last = this.state.lastPick;
    const strings = getUiStrings();
    const payload = {
      type: "state" as const,
      state: {
        browserOpen: this.state.browserOpen,
        selectMode: this.state.selectMode,
        cloneMode: this.state.cloneMode,
        currentUrl: this.state.currentUrl,
        status: this.state.status,
        statusKind: this.state.statusKind || "idle",
        language: getLocale(),
        languages: getLanguageOptions(),
        strings,
        cloneOptions: getCloneOptions(),
        lastPick: last
          ? {
              selector: last.selector,
              url: last.url,
              contextPath: last.contextPath,
              imagePath: last.imagePath,
              timestamp: last.timestamp,
              isClone: !!last.isClone,
              cloneMdPath: last.cloneMdPath,
              agentMdPath: last.agentMdPath,
            }
          : null,
        defaultUrl: this.actions.getDefaultUrl(),
      },
    };

    if (this.view) {
      try {
        void this.view.webview.postMessage(payload);
      } catch {
        /* webview may be in invalid SW state */
      }
    }
    for (const w of this.externalWebviews) {
      try {
        void w.postMessage(payload);
      } catch {
        /* ignore */
      }
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'unsafe-inline'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DaVinchi Element Picker</title>
  <style>
    :root {
      color-scheme: light dark;
      --radius: 4px;
      --ease: cubic-bezier(0.16, 1, 0.3, 1);
      --border: var(--vscode-widget-border, var(--vscode-editorWidget-border, rgba(128,128,128,0.25)));
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      min-width: 200px;
    }
    button, input, select { font: inherit; color: inherit; }
    svg { flex: none; }

    /* ── Header ─────────────────────────────── */
    .hdr {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px 11px;
      border-bottom: 1px solid var(--border);
    }
    .hdr .logo { color: var(--vscode-foreground); opacity: 0.9; }
    .hdr-name {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.01em;
      line-height: 1.2;
    }
    .hdr-sub {
      font-size: 10px;
      line-height: 1.2;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .pill {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      transition: color 150ms var(--ease), border-color 150ms var(--ease);
    }
    .pill .dot { width: 6px; height: 6px; }
    .pill.on { color: var(--vscode-foreground); }

    /* ── Sections ───────────────────────────── */
    .main { flex: 1 1 auto; overflow-y: auto; padding: 14px; }
    .sec { margin-bottom: 18px; }
    .sec-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 7px;
      user-select: none;
    }

    /* ── URL group ──────────────────────────── */
    .url-group { display: flex; gap: 6px; }
    .url-group input {
      flex: 1 1 auto;
      min-width: 0;
      padding: 5px 8px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-input-border, transparent);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      outline: none;
      transition: border-color 150ms var(--ease);
    }
    .url-group input::placeholder { color: var(--vscode-input-placeholderForeground); }
    .url-group input:focus { border-color: var(--vscode-focusBorder); }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      white-space: nowrap;
      transition: background 150ms var(--ease), opacity 150ms var(--ease);
    }
    .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn.primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn:disabled { opacity: 0.4; cursor: default; }
    .btn:disabled:hover { background: var(--vscode-button-secondaryBackground); }
    .btn.primary:disabled:hover { background: var(--vscode-button-background); }
    button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .conn-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 7px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .conn-row .conn-url {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--vscode-editor-font-family);
    }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 7px;
      font-size: 11px;
      border-radius: var(--radius);
      border: 1px solid transparent;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      transition: background 150ms var(--ease), color 150ms var(--ease);
    }
    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15));
      color: var(--vscode-foreground);
    }

    /* ── Mode tiles ─────────────────────────── */
    .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media (max-width: 250px) { .modes { grid-template-columns: 1fr; } }
    .mode {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      text-align: left;
      padding: 9px 10px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      transition: background 150ms var(--ease), border-color 150ms var(--ease);
    }
    .mode:hover { background: var(--vscode-list-hoverBackground); }
    .mode:disabled { opacity: 0.45; cursor: default; }
    .mode:disabled:hover { background: transparent; }
    .mode.active {
      background: var(--vscode-inputOption-activeBackground, rgba(0,122,204,0.18));
      border-color: var(--vscode-inputOption-activeBorder, var(--vscode-focusBorder));
      color: var(--vscode-inputOption-activeForeground, var(--vscode-foreground));
    }
    .mode-head {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 12px;
      line-height: 1.2;
    }
    .mode-head svg { opacity: 0.9; }
    .mode-desc {
      font-size: 10.5px;
      line-height: 1.35;
      color: var(--vscode-descriptionForeground);
    }
    .mode.active .mode-desc { color: inherit; opacity: 0.85; }
    .mode kbd {
      font-family: var(--vscode-editor-font-family);
      font-size: 9.5px;
      line-height: 1;
      padding: 2px 5px;
      border-radius: 3px;
      background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.15));
      color: var(--vscode-keybindingLabel-foreground, inherit);
      border: 1px solid var(--vscode-keybindingLabel-border, transparent);
      border-bottom-color: var(--vscode-keybindingLabel-bottomBorder, transparent);
    }

    /* ── Clone settings ─────────────────────── */
    .clone-set {
      margin-bottom: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .clone-set summary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      user-select: none;
      list-style: none;
      transition: color 150ms var(--ease), background 150ms var(--ease);
    }
    .clone-set summary::-webkit-details-marker { display: none; }
    .clone-set summary:hover { background: var(--vscode-list-hoverBackground); }
    .clone-set summary .chev {
      margin-left: auto;
      transition: transform 150ms var(--ease);
    }
    .clone-set[open] summary .chev { transform: rotate(90deg); }
    .clone-set.armed {
      border-color: var(--vscode-inputOption-activeBorder, var(--vscode-focusBorder));
    }
    .clone-set.armed summary { color: var(--vscode-foreground); }
    .opts {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 4px 6px 8px;
      border-top: 1px solid var(--border);
    }
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 4px 5px;
      border-radius: var(--radius);
      cursor: pointer;
    }
    .opt:hover { background: var(--vscode-list-hoverBackground); }
    .opt input {
      flex: none;
      margin: 2px 0 0;
      accent-color: var(--vscode-inputOption-activeBorder, #4fc3f7);
      cursor: pointer;
    }
    .opt-body { min-width: 0; }
    .opt-text { font-size: 11.5px; line-height: 1.35; }
    .opt-hint {
      font-size: 10px;
      line-height: 1.35;
      color: var(--vscode-descriptionForeground);
      margin-top: 1px;
    }
    .opt-sep {
      height: 1px;
      margin: 5px 4px;
      background: var(--border);
    }

    /* ── Status line ────────────────────────── */
    .status-line {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      padding: 7px 9px;
      margin-bottom: 18px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      border: 1px solid var(--border);
      font-size: 11.5px;
      line-height: 1.4;
      word-break: break-word;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex: none;
      background: var(--vscode-descriptionForeground);
      transition: background 150ms var(--ease);
    }
    .status-line .dot { margin-top: 4px; }
    .dot.ok { background: var(--vscode-charts-green, #3fb950); }
    .dot.busy { background: var(--vscode-charts-yellow, #d29922); animation: pulse 1.2s ease-in-out infinite; }
    .dot.err { background: var(--vscode-errorForeground, #f85149); }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; animation: none !important; }
    }

    /* ── Last capture ───────────────────────── */
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 18px 12px;
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      color: var(--vscode-descriptionForeground);
    }
    .empty svg { opacity: 0.5; margin-bottom: 2px; }
    .empty-title { font-size: 12px; font-weight: 600; color: var(--vscode-foreground); opacity: 0.8; }
    .empty-body { font-size: 11px; line-height: 1.45; max-width: 30ch; }
    .card {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      overflow: hidden;
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px 0;
    }
    .card-top code {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--vscode-editor-font-family);
      font-size: 11.5px;
      font-weight: 600;
    }
    .chip {
      flex: none;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 3px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .card-meta {
      padding: 3px 10px 8px;
      font-size: 10.5px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border-top: 1px solid var(--border);
    }
    .card-actions button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 7px 4px;
      font-size: 11px;
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      transition: background 150ms var(--ease);
    }
    .card-actions button + button { border-left: 1px solid var(--border); }
    .card-actions button:hover { background: var(--vscode-list-hoverBackground); }
    .card-actions button svg { opacity: 0.75; }

    /* ── Footer ─────────────────────────────── */
    .ftr {
      flex: none;
      padding: 10px 14px 12px;
      border-top: 1px solid var(--border);
    }
    .lang {
      display: flex;
      align-items: center;
      gap: 7px;
      color: var(--vscode-descriptionForeground);
    }
    .lang select {
      flex: 1 1 auto;
      min-width: 0;
      padding: 3px 6px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-dropdown-border, transparent);
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      outline: none;
      font-size: 11.5px;
    }
    .how { margin-top: 9px; }
    .how summary {
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      user-select: none;
      list-style-position: inside;
    }
    .how .hint {
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.5;
      color: var(--vscode-descriptionForeground);
    }
    .how .hint code {
      font-family: var(--vscode-editor-font-family);
      font-size: 10.5px;
      background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.12));
      padding: 1px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <header class="hdr">
    <svg class="logo" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.1" opacity="0.35"/>
      <path d="M5.5 8.2V5.5H8.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.8 5.5H18.5V8.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.5 15.8V18.5H15.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8.2 18.5H5.5V15.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
    <div>
      <div class="hdr-name">DaVinchi</div>
      <div class="hdr-sub" id="hdrSub">Element Picker</div>
    </div>
    <span class="pill" id="connPill"><span class="dot" id="connDot"></span><span id="connText"></span></span>
  </header>

  <div class="main">
    <section class="sec">
      <div class="sec-label" id="lblPage">Page</div>
      <div class="url-group">
        <input id="url" type="text" placeholder="https://…" autocomplete="off" spellcheck="false" />
        <button class="btn primary" id="btnOpen">Open</button>
      </div>
      <div class="conn-row" id="connRow" hidden>
        <span class="dot ok"></span>
        <span class="conn-url" id="connUrl"></span>
        <button class="icon-btn" id="btnClose">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span id="btnCloseLabel">Close</span>
        </button>
      </div>
    </section>

    <section class="sec">
      <div class="sec-label" id="lblCapture">Capture mode</div>
      <div class="modes">
        <button class="mode" id="btnSelect" aria-pressed="false">
          <span class="mode-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.7"/>
              <path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
            </svg>
            <span id="selectName">Select</span>
          </span>
          <span class="mode-desc" id="selectDesc"></span>
          <kbd id="kbdSelect">Ctrl+Shift+E</kbd>
        </button>
        <button class="mode" id="btnClone" aria-pressed="false">
          <span class="mode-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/>
              <path d="M16 4.5V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
            <span id="cloneName">Clone</span>
          </span>
          <span class="mode-desc" id="cloneDesc"></span>
          <kbd id="kbdClone">Ctrl+Shift+Alt+C</kbd>
        </button>
      </div>
    </section>

    <details class="clone-set" id="cloneSet">
      <summary>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" stroke="currentColor" stroke-width="1.7"/>
          <path d="M19.4 13.5a1.8 1.8 0 0 0 .36 1.98l.06.07a2.2 2.2 0 1 1-3.11 3.11l-.07-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V20a2.2 2.2 0 1 1-4.4 0v-.11a1.8 1.8 0 0 0-1.18-1.65 1.8 1.8 0 0 0-1.98.36l-.07.06a2.2 2.2 0 1 1-3.11-3.11l.06-.07a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.65-1.09H4a2.2 2.2 0 1 1 0-4.4h.11a1.8 1.8 0 0 0 1.65-1.18 1.8 1.8 0 0 0-.36-1.98l-.06-.07a2.2 2.2 0 1 1 3.11-3.11l.07.06a1.8 1.8 0 0 0 1.98.36h.09a1.8 1.8 0 0 0 1.09-1.65V4a2.2 2.2 0 1 1 4.4 0v.11a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.07-.06a2.2 2.2 0 1 1 3.11 3.11l-.06.07a1.8 1.8 0 0 0-.36 1.98v.09a1.8 1.8 0 0 0 1.65 1.09H20a2.2 2.2 0 1 1 0 4.4h-.11a1.8 1.8 0 0 0-1.65 1.09z" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <span id="lblCloneSet">Clone settings</span>
        <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </summary>
      <div class="opts" id="cloneOpts"></div>
    </details>

    <div class="status-line" aria-live="polite">
      <span class="dot" id="statusDot"></span><span id="statusText">Ready</span>
    </div>

    <section class="sec">
      <div class="sec-label" id="lblLast">Last capture</div>
      <div class="empty" id="lastEmpty">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M11 11l7.5 2.8-3.2 1.5 3 3-1.6 1.6-3-3-1.5 3.2L11 11z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
        <div class="empty-title" id="emptyTitle"></div>
        <div class="empty-body" id="emptyBody"></div>
      </div>
      <div class="card" id="lastCard" hidden>
        <div class="card-top">
          <code id="lastSelector" title=""></code>
          <span class="chip" id="cloneChip" hidden>CLONE</span>
        </div>
        <div class="card-meta" id="lastMeta" title=""></div>
        <div class="card-actions">
          <button id="btnAttach">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 17l6-5-6-5M12 19h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span id="btnAttachLabel">Terminal</span>
          </button>
          <button id="btnCopy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.7"/>
            </svg>
            <span id="btnCopyLabel">Copy</span>
          </button>
          <button id="btnReveal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
            </svg>
            <span id="btnRevealLabel">Folder</span>
          </button>
        </div>
      </div>
    </section>
  </div>

  <footer class="ftr">
    <div class="lang">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21M12 3C9.5 5.6 8.2 8.7 8.2 12s1.3 6.4 3.8 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <select id="language" aria-label="Language"></select>
    </div>
    <details class="how">
      <summary id="howLabel">How it works</summary>
      <div class="hint" id="hint"></div>
    </details>
  </footer>

  <script>
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);
    const urlEl = $('url');
    const langEl = $('language');

    let strings = {};
    let applyingLang = false;
    let applyingUrl = false;

    // Restore the typed URL across remounts (retainContextWhenHidden=false)
    const persisted = vscode.getState();
    if (persisted && persisted.url) urlEl.value = persisted.url;

    const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent);
    $('kbdSelect').textContent = isMac ? '⌘⇧E' : 'Ctrl+Shift+E';
    $('kbdClone').textContent = isMac ? '⌘⇧⌥C' : 'Ctrl+Shift+Alt+C';

    function post(type, extra) {
      vscode.postMessage(Object.assign({ type: type }, extra || {}));
    }

    $('btnOpen').addEventListener('click', () => post('open', { url: urlEl.value.trim() }));
    urlEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') post('open', { url: urlEl.value.trim() });
    });
    urlEl.addEventListener('input', () => {
      vscode.setState({ url: urlEl.value });
    });
    $('btnSelect').addEventListener('click', () => post('toggleSelect'));
    $('btnClone').addEventListener('click', () => post('toggleClone'));

    // ── Clone settings checkboxes ─────────────
    const cloneSetEl = $('cloneSet');
    const cloneOptsEl = $('cloneOpts');
    const CLONE_OPTS = [
      { key: 'fullSite', label: 'cloneOptFullSite', hint: 'cloneOptFullSiteHint' },
      { key: 'oneShot', label: 'cloneOptOneShot', hint: 'cloneOptOneShotHint' },
      { sep: true },
      { key: 'zip', label: 'cloneOptZip' },
      { key: 'previewHtml', label: 'cloneOptPreview' },
      { key: 'latestMirror', label: 'cloneOptLatest' },
      { key: 'assets', label: 'cloneOptAssets' },
      { key: 'pageScreenshot', label: 'cloneOptPageShot' },
      { key: 'parentScreenshot', label: 'cloneOptParentShot' },
      { key: 'computedJson', label: 'cloneOptComputed' },
      { key: 'inlineSvgs', label: 'cloneOptSvg' }
    ];
    const cloneInputs = {};
    const cloneLabelEls = [];
    let applyingCloneOpts = false;
    let prevCloneMode = null;

    CLONE_OPTS.forEach((def) => {
      if (def.sep) {
        const sep = document.createElement('div');
        sep.className = 'opt-sep';
        cloneOptsEl.appendChild(sep);
        return;
      }
      const label = document.createElement('label');
      label.className = 'opt';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => {
        if (applyingCloneOpts) return;
        post('setCloneOption', { key: def.key, value: input.checked });
      });
      const body = document.createElement('div');
      body.className = 'opt-body';
      const text = document.createElement('div');
      text.className = 'opt-text';
      body.appendChild(text);
      let hint = null;
      if (def.hint) {
        hint = document.createElement('div');
        hint.className = 'opt-hint';
        body.appendChild(hint);
      }
      label.appendChild(input);
      label.appendChild(body);
      cloneOptsEl.appendChild(label);
      cloneInputs[def.key] = input;
      cloneLabelEls.push({ textEl: text, textKey: def.label, hintEl: hint, hintKey: def.hint });
    });

    function relabelCloneOpts(s) {
      cloneLabelEls.forEach((item) => {
        item.textEl.textContent = s[item.textKey] || item.textKey;
        if (item.hintEl) item.hintEl.textContent = s[item.hintKey] || '';
      });
      $('lblCloneSet').textContent = s.sectionCloneSettings || 'Clone settings';
    }
    $('btnClose').addEventListener('click', () => post('close'));
    $('btnAttach').addEventListener('click', () => post('attach'));
    $('btnCopy').addEventListener('click', () => post('copy'));
    $('btnReveal').addEventListener('click', () => post('reveal'));
    langEl.addEventListener('change', () => {
      if (applyingLang) return;
      post('setLanguage', { language: langEl.value });
    });

    function applyStrings(s) {
      strings = s || {};
      $('lblPage').textContent = s.sectionPage || 'Page';
      $('lblCapture').textContent = s.sectionCapture || 'Capture mode';
      $('lblLast').textContent = s.sectionLast || 'Last capture';
      $('btnOpen').textContent = s.openShort || 'Open';
      $('btnCloseLabel').textContent = s.closeBrowser || 'Close';
      $('selectName').textContent = s.selectMode || 'Select';
      $('cloneName').textContent = s.cloneMode || 'Clone';
      $('selectDesc').textContent = s.selectModeDesc || '';
      $('cloneDesc').textContent = s.cloneModeDesc || '';
      $('emptyTitle').textContent = s.emptyLastTitle || 'No captures yet';
      $('emptyBody').textContent = s.emptyLastBody || '';
      $('btnAttachLabel').textContent = s.attachShort || 'Terminal';
      $('btnCopyLabel').textContent = s.copyShort || 'Copy';
      $('btnRevealLabel').textContent = s.revealShort || 'Folder';
      $('cloneChip').textContent = s.cloneChipLabel || 'CLONE';
      $('howLabel').textContent = s.howItWorks || 'How it works';
      $('hint').innerHTML = s.hint || '';
      $('btnAttach').title = s.attachLast || '';
      $('btnCopy').title = s.copyPaths || '';
      $('btnReveal').title = s.revealFolder || '';
      urlEl.placeholder = s.urlPlaceholder || 'https://…';
      relabelCloneOpts(s);
    }

    function fillLanguages(list, current) {
      applyingLang = true;
      langEl.innerHTML = '';
      (list || []).forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.label;
        if (item.code === current) opt.selected = true;
        langEl.appendChild(opt);
      });
      applyingLang = false;
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || msg.type !== 'state') return;
      const s = msg.state;
      if (s.strings) applyStrings(s.strings);
      if (s.languages) fillLanguages(s.languages, s.language);

      // Never force a preset site — only reflect live browser URL or what the user typed
      if (s.currentUrl && !urlEl.matches(':focus')) {
        urlEl.value = s.currentUrl;
        vscode.setState({ url: s.currentUrl });
      }

      // Connection pill + row
      $('connText').textContent = s.browserOpen
        ? (strings.connectedLabel || 'Connected')
        : (strings.disconnectedLabel || 'No browser');
      $('connPill').classList.toggle('on', !!s.browserOpen);
      $('connDot').className = 'dot ' + (s.browserOpen ? 'ok' : '');
      $('connRow').hidden = !s.browserOpen;
      if (s.browserOpen) $('connUrl').textContent = s.currentUrl || '';

      // Mode tiles
      const sel = $('btnSelect'), clo = $('btnClone');
      sel.classList.toggle('active', !!s.selectMode);
      sel.setAttribute('aria-pressed', String(!!s.selectMode));
      clo.classList.toggle('active', !!s.cloneMode);
      clo.setAttribute('aria-pressed', String(!!s.cloneMode));
      sel.disabled = !s.browserOpen;
      clo.disabled = !s.browserOpen;
      sel.title = s.browserOpen ? '' : (strings.errBrowserNotOpen || '');
      clo.title = s.browserOpen ? '' : (strings.errBrowserNotOpen || '');

      // Clone settings: sync checkboxes, auto expand/collapse with the mode
      if (s.cloneOptions) {
        applyingCloneOpts = true;
        Object.keys(cloneInputs).forEach((k) => {
          if (typeof s.cloneOptions[k] === 'boolean') {
            cloneInputs[k].checked = s.cloneOptions[k];
          }
        });
        applyingCloneOpts = false;
      }
      cloneSetEl.classList.toggle('armed', !!s.cloneMode);
      if (prevCloneMode !== !!s.cloneMode) {
        if (prevCloneMode !== null || s.cloneMode) {
          cloneSetEl.open = !!s.cloneMode;
        }
        prevCloneMode = !!s.cloneMode;
      }

      // Status line
      const kind = s.statusKind || 'idle';
      $('statusDot').className = 'dot ' +
        (kind === 'ok' ? 'ok' : kind === 'busy' ? 'busy' : kind === 'error' ? 'err' : '');
      $('statusText').textContent = s.status || '';

      // Last capture
      const last = s.lastPick;
      $('lastEmpty').hidden = !!last;
      $('lastCard').hidden = !last;
      if (last) {
        const selCode = $('lastSelector');
        selCode.textContent = last.selector;
        selCode.title = last.selector;
        $('cloneChip').hidden = !last.isClone;
        const meta = $('lastMeta');
        meta.textContent = last.timestamp + (last.url ? ' · ' + last.url : '');
        meta.title = (last.agentMdPath || last.contextPath || '') + '\\n' + (last.imagePath || '');
      }

      document.documentElement.lang = s.language || 'en';
    });

    post('ready');
  </script>
</body>
</html>`;
  }
}

function formatUi(template: string, ...args: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? "");
}
