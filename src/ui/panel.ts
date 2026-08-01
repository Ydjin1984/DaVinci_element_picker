import * as vscode from "vscode";
import {
  getLanguageOptions,
  getLocale,
  getUiStrings,
  setLocale,
  type Locale,
} from "../i18n";
import type { SavedPick } from "../types";

export type PanelActions = {
  openBrowser: (url: string) => Promise<void>;
  toggleSelect: () => Promise<boolean>;
  closeBrowser: () => Promise<void>;
  attachLast: () => Promise<void>;
  copyLast: () => Promise<void>;
  openLastFolder: () => Promise<void>;
  getDefaultUrl: () => string;
  getState: () => PanelState;
  onLanguageChanged?: (locale: Locale) => void;
};

export interface PanelState {
  browserOpen: boolean;
  selectMode: boolean;
  currentUrl: string;
  lastPick: SavedPick | null;
  status: string;
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
    currentUrl: "",
    lastPick: null,
    status: "Ready",
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

  private async handleMessage(msg: { type?: string; url?: string; language?: string }): Promise<void> {
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
        currentUrl: this.state.currentUrl,
        status: this.state.status,
        language: getLocale(),
        languages: getLanguageOptions(),
        strings,
        lastPick: last
          ? {
              selector: last.selector,
              url: last.url,
              contextPath: last.contextPath,
              imagePath: last.imagePath,
              timestamp: last.timestamp,
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
      --gap: 10px;
      --radius: 6px;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      margin: 0;
      padding: 12px;
    }
    h1 {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 12px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    label {
      display: block;
      font-size: 11px;
      opacity: 0.75;
      margin-bottom: 4px;
    }
    input[type="text"], select {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-input-border, transparent);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      outline: none;
      font: inherit;
    }
    input[type="text"]:focus, select:focus {
      border-color: var(--vscode-focusBorder);
    }
    .row { margin-bottom: var(--gap); }
    .btns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 12px 0;
    }
    button {
      padding: 7px 10px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      font: inherit;
    }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      grid-column: 1 / -1;
    }
    button:hover { filter: brightness(1.08); }
    button:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }
    button.active {
      outline: 1px solid var(--vscode-focusBorder);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .status {
      font-size: 12px;
      padding: 8px;
      border-radius: var(--radius);
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, transparent);
      word-break: break-word;
      line-height: 1.4;
    }
    .status .muted { opacity: 0.7; font-size: 11px; }
    .hint {
      margin-top: 14px;
      font-size: 11px;
      opacity: 0.7;
      line-height: 1.45;
    }
    code {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 10px;
      margin-left: 6px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge.on { background: #0e639c; color: #fff; }
  </style>
</head>
<body>
  <h1 id="title">DaVinchi Element Picker</h1>

  <div class="row">
    <label for="language" id="lblLanguage">Language</label>
    <select id="language"></select>
  </div>

  <div class="row">
    <label for="url" id="lblUrl">URL</label>
    <input id="url" type="text" placeholder="" autocomplete="off" spellcheck="false" />
  </div>

  <div class="btns">
    <button class="primary" id="btnOpen">Open browser</button>
    <button id="btnSelect">Select mode</button>
    <button id="btnClose">Close browser</button>
    <button id="btnAttach">Attach last → terminal</button>
    <button id="btnCopy">Copy paths</button>
    <button id="btnReveal">Reveal folder</button>
  </div>

  <div class="status" id="status">
    <div>Ready</div>
  </div>

  <div class="hint" id="hint"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const urlEl = document.getElementById('url');
    const langEl = document.getElementById('language');
    const statusEl = document.getElementById('status');
    const hintEl = document.getElementById('hint');
    const titleEl = document.getElementById('title');
    const lblUrl = document.getElementById('lblUrl');
    const lblLanguage = document.getElementById('lblLanguage');
    const btnOpen = document.getElementById('btnOpen');
    const btnSelect = document.getElementById('btnSelect');
    const btnClose = document.getElementById('btnClose');
    const btnAttach = document.getElementById('btnAttach');
    const btnCopy = document.getElementById('btnCopy');
    const btnReveal = document.getElementById('btnReveal');

    let strings = {};
    let applyingLang = false;

    btnOpen.addEventListener('click', () => {
      vscode.postMessage({ type: 'open', url: urlEl.value.trim() });
    });
    urlEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        vscode.postMessage({ type: 'open', url: urlEl.value.trim() });
      }
    });
    btnSelect.addEventListener('click', () => vscode.postMessage({ type: 'toggleSelect' }));
    btnClose.addEventListener('click', () => vscode.postMessage({ type: 'close' }));
    btnAttach.addEventListener('click', () => vscode.postMessage({ type: 'attach' }));
    btnCopy.addEventListener('click', () => vscode.postMessage({ type: 'copy' }));
    btnReveal.addEventListener('click', () => vscode.postMessage({ type: 'reveal' }));
    langEl.addEventListener('change', () => {
      if (applyingLang) return;
      vscode.postMessage({ type: 'setLanguage', language: langEl.value });
    });

    function applyStrings(s) {
      strings = s || {};
      titleEl.textContent = s.panelTitle || 'DaVinchi Element Picker';
      lblUrl.textContent = s.urlLabel || 'URL';
      lblLanguage.textContent = s.languageLabel || 'Language';
      btnOpen.textContent = s.openBrowser || 'Open browser';
      btnClose.textContent = s.closeBrowser || 'Close browser';
      btnAttach.textContent = s.attachLast || 'Attach last';
      btnCopy.textContent = s.copyPaths || 'Copy paths';
      btnReveal.textContent = s.revealFolder || 'Reveal folder';
      hintEl.innerHTML = s.hint || '';
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
      if (s.currentUrl) urlEl.value = s.currentUrl;

      btnSelect.classList.toggle('active', !!s.selectMode);
      btnSelect.textContent = s.selectMode
        ? (strings.selectModeOn || 'Select mode ON')
        : (strings.selectMode || 'Select mode');
      btnSelect.disabled = !s.browserOpen;
      btnClose.disabled = !s.browserOpen;
      btnAttach.disabled = !s.lastPick;
      btnCopy.disabled = !s.lastPick;
      btnReveal.disabled = !s.lastPick;

      const modeBadge = s.selectMode
        ? '<span class="badge on">' + escapeHtml(strings.badgeSelectOn || 'SELECT ON') + '</span>'
        : (s.browserOpen
            ? '<span class="badge">' + escapeHtml(strings.badgeBrowserOpen || 'browser open') + '</span>'
            : '');

      let html = '<div>' + escapeHtml(s.status || '') + modeBadge + '</div>';
      if (s.lastPick) {
        html += '<div class="muted" style="margin-top:6px">' +
          escapeHtml(strings.lastLabel || 'Last:') + ' <b>' +
          escapeHtml(s.lastPick.selector) + '</b><br/>' +
          escapeHtml(s.lastPick.contextPath) + '<br/>' +
          escapeHtml(s.lastPick.imagePath) + '</div>';
      }
      statusEl.innerHTML = html;
      document.documentElement.lang = s.language || 'en';
    });

    function escapeHtml(t) {
      return String(t)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}

function formatUi(template: string, ...args: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? "");
}
