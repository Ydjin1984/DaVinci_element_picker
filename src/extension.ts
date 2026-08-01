import * as vscode from "vscode";
import type { Page } from "playwright-core";
import {
  BrowserSession,
  ensureBrowserPathSetting,
} from "./browser/browserSession";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  attachEverywhere,
  copyToClipboard,
  insertIntoTerminal,
} from "./chat/chatBridge";
import {
  LOCALE_NATIVE_NAMES,
  getLocale,
  onDidChangeLanguage,
  pickAndSaveLanguage,
  t,
} from "./i18n";
import {
  ensureGitignoreEntry,
  getLatestPaths,
  savePick,
} from "./storage/pickStore";
import type { ElementPickPayload, SavedPick } from "./types";
import { showActionMenu } from "./ui/actionMenu";
import { ControlsTreeProvider } from "./ui/controlsTree";
import { EditorControlPanel } from "./ui/editorPanel";
import {
  ElementPickerPanelProvider,
  type PanelState,
} from "./ui/panel";
import { StatusBarController } from "./ui/statusBar";

let session: BrowserSession;
let lastPick: SavedPick | null = null;
let panel: ElementPickerPanelProvider;
let controlsTree: ControlsTreeProvider;
let editorPanel: EditorControlPanel;
let statusBar: StatusBarController;
let pickingLock = false;

/** User setting only — empty by default (no built-in site preset). */
function defaultUrl(): string {
  return (
    vscode.workspace
      .getConfiguration("elementPicker")
      .get<string>("defaultUrl", "") || ""
  ).trim();
}

/** Ask for any URL (local or remote) when none is known. */
async function askUrl(initial?: string): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    prompt: t("promptUrl"),
    value: (initial || session.currentUrl || defaultUrl() || "").trim(),
    placeHolder: t("urlPlaceholder"),
    ignoreFocusOut: true,
    validateInput: (v) =>
      v.trim() ? undefined : t("errUrlEmpty"),
  });
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function autoAttach(): boolean {
  return vscode.workspace
    .getConfiguration("elementPicker")
    .get<boolean>("autoAttach", true);
}

function panelState(): PanelState {
  return {
    browserOpen: session.isOpen,
    selectMode: session.isSelectMode,
    currentUrl: session.currentUrl || defaultUrl(),
    lastPick,
    status: session.isOpen
      ? session.isSelectMode
        ? t("statusSelectOn")
        : t("statusBrowserOpen")
      : lastPick
        ? t("statusLastPick", lastPick.selector)
        : t("statusReady"),
  };
}

function syncUi(extraStatus?: string): void {
  const st = panelState();
  if (extraStatus) {
    st.status = extraStatus;
  }
  panel.updateState(st);
  controlsTree?.refresh(st);
  if (session.isOpen) {
    statusBar.setBrowserOpen(session.isSelectMode);
  } else {
    statusBar.setClosed();
  }
}

function showErr(e: unknown): void {
  const err = e instanceof Error ? e.message : String(e);
  // Long browser-launch diagnostics: modal so the full text is readable
  if (err.includes("Could not launch a browser") || err.length > 180) {
    void vscode.window
      .showErrorMessage(t("errPrefix", err.split("\n")[0] || err), {
        modal: true,
        detail: err,
      } as vscode.MessageOptions)
      .then(() => undefined);
    return;
  }
  void vscode.window.showErrorMessage(t("errPrefix", err));
}

async function openBrowser(url?: string): Promise<void> {
  let target = (url || "").trim();
  if (!target) {
    target = (await askUrl()) || "";
  }
  if (!target) {
    throw new Error(t("errUrlEmpty"));
  }
  const finalUrl = /^https?:\/\//i.test(target) ? target : `http://${target}`;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t("msgOpening", finalUrl),
        cancellable: false,
      },
      async () => {
        await session.open(finalUrl);
      }
    );
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    // Remote CDP not ready → guided retry loop
    if (
      err.includes("CDP") ||
      err.includes("ECONNREFUSED") ||
      err.includes("9222") ||
      err.includes("Remote SSH")
    ) {
      await handleCdpConnectFailure(finalUrl, err);
      return;
    }
    throw e;
  }

  await ensureGitignoreEntry();
  syncUi(t("statusBrowserOpenUrl", finalUrl));
  void vscode.window.showInformationMessage(t("msgBrowserOpened"));
}

/**
 * Help user start local Chrome + reverse port, then retry CDP.
 */
async function handleCdpConnectFailure(
  finalUrl: string,
  originalErr: string
): Promise<void> {
  const choice = await vscode.window.showErrorMessage(
    t("cdpNeedLocalChrome"),
    { modal: true, detail: originalErr } as vscode.MessageOptions,
    t("cdpActionStartChrome"),
    t("cdpActionRetry"),
    t("cdpActionCopyCmd")
  );

  if (choice === t("cdpActionStartChrome") || choice === t("cdpActionCopyCmd")) {
    const cmd = BrowserSession.localChromeDebugCommand(finalUrl, 9222);
    await vscode.env.clipboard.writeText(cmd);
    if (choice === t("cdpActionStartChrome") && process.platform === "win32" && !vscode.env.remoteName) {
      try {
        const ps1 = path.join(os.tmpdir(), "davinci-start-chrome.ps1");
        fs.writeFileSync(ps1, cmd, "utf8");
        const term = vscode.window.createTerminal({
          name: "DaVinchi Local Chrome",
          shellPath: "powershell.exe",
        });
        term.show(true);
        term.sendText(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`
        );
      } catch {
        /* clipboard only */
      }
    }
    void vscode.window.showInformationMessage(
      t("msgLocalChromeStarted") +
        (vscode.env.remoteName
          ? "\n\n" + t("cdpReversePortHint")
          : "")
    );
  }

  if (
    choice === t("cdpActionStartChrome") ||
    choice === t("cdpActionRetry") ||
    choice === t("cdpActionCopyCmd")
  ) {
    const again = await vscode.window.showInformationMessage(
      t("cdpReadyRetry"),
      t("cdpActionRetry")
    );
    if (again === t("cdpActionRetry")) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t("msgOpening", finalUrl),
          cancellable: false,
        },
        async () => {
          await session.open(finalUrl);
        }
      );
      await ensureGitignoreEntry();
      syncUi(t("statusBrowserOpenUrl", finalUrl));
      void vscode.window.showInformationMessage(t("msgBrowserOpened"));
    }
  }
}

async function toggleSelect(): Promise<boolean> {
  if (!session.isOpen) {
    await openBrowser();
  }
  if (!session.isOpen) {
    throw new Error(t("errBrowserNotOpen"));
  }
  const on = await session.toggleSelectMode();
  syncUi(on ? t("statusSelectOnHover") : t("statusSelectOff"));
  return on;
}

async function closeBrowser(): Promise<void> {
  await session.close();
  syncUi(t("statusBrowserClosed"));
}

async function handlePick(
  payload: ElementPickPayload,
  page: Page
): Promise<void> {
  if (pickingLock) {
    return;
  }
  pickingLock = true;
  try {
    syncUi(t("statusCapturing", payload.selector));
    const png = await session.screenshotElement(payload);
    const saved = await savePick(payload, png);
    lastPick = saved;

    if (autoAttach()) {
      await attachEverywhere(saved);
      syncUi(
        t("statusSavedAttached", payload.selector, saved.timestamp)
      );
      void vscode.window.showInformationMessage(
        t("msgSavedAttached", payload.selector)
      );
    } else {
      syncUi(t("statusSaved", payload.selector, saved.timestamp));
      void vscode.window.showInformationMessage(
        t("msgSavedManual", payload.selector)
      );
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    syncUi(t("statusPickFailed", err));
    void vscode.window.showErrorMessage(t("errPrefix", err));
  } finally {
    pickingLock = false;
    void page;
  }
}

async function requireLastPick(): Promise<SavedPick> {
  if (lastPick) {
    return lastPick;
  }
  const latest = getLatestPaths();
  if (latest) {
    const synthetic: SavedPick = {
      folderUri: vscode.Uri.file(
        latest.contextPath.replace(/[\\/]context\.md$/i, "")
      ),
      contextUri: vscode.Uri.file(latest.contextPath),
      imageUri: vscode.Uri.file(latest.imagePath),
      contextPath: latest.contextPath,
      imagePath: latest.imagePath,
      selector: "(latest)",
      url: "",
      timestamp: "latest",
    };
    try {
      await vscode.workspace.fs.stat(synthetic.contextUri);
      lastPick = synthetic;
      return synthetic;
    } catch {
      /* fall through */
    }
  }
  throw new Error(t("errNoPick"));
}

async function attachLast(): Promise<void> {
  const pick = await requireLastPick();
  await insertIntoTerminal(pick);
  syncUi(t("statusPathsTerminal"));
}

async function copyLast(): Promise<void> {
  const pick = await requireLastPick();
  await copyToClipboard(pick);
  syncUi(t("statusPathsClipboard"));
  void vscode.window.showInformationMessage(t("msgCopied"));
}

async function openLastFolder(): Promise<void> {
  const pick = await requireLastPick();
  await vscode.commands.executeCommand("revealFileInOS", pick.folderUri);
}

function onLanguageChange(): void {
  panel.refreshI18n();
  syncUi();
  statusBar.setIdle();
  if (session.isOpen) {
    statusBar.setBrowserOpen(session.isSelectMode);
  }
  const locale = getLocale();
  void vscode.window.showInformationMessage(
    t("msgLanguageChanged", `${LOCALE_NATIVE_NAMES[locale]} (${locale})`)
  );
}

export function activate(context: vscode.ExtensionContext): void {
  session = new BrowserSession();
  statusBar = new StatusBarController();

  session.setPickHandler(handlePick);
  session.setModeHandler(() => syncUi());

  // Pin system Chrome/Edge path so Playwright never falls into empty cache
  void ensureBrowserPathSetting().then((p) => {
    if (p) {
      console.log("[DaVinchi] browserPath →", p);
    }
  });

  panel = new ElementPickerPanelProvider(context.extensionUri, {
    openBrowser,
    toggleSelect,
    closeBrowser,
    attachLast,
    copyLast,
    openLastFolder,
    getDefaultUrl: defaultUrl,
    getState: panelState,
    onLanguageChanged: () => {
      // setLocale already fired configuration change; avoid double toast if both fire
      panel.refreshI18n();
      syncUi();
      statusBar.setIdle();
      if (session.isOpen) {
        statusBar.setBrowserOpen(session.isSelectMode);
      }
    },
  });

  controlsTree = new ControlsTreeProvider();
  editorPanel = new EditorControlPanel(context.extensionUri, panel);

  context.subscriptions.push(
    // Native tree first — never depends on Service Worker
    vscode.window.registerTreeDataProvider(
      ControlsTreeProvider.viewId,
      controlsTree
    ),
    // Sidebar webview: do NOT retain context when hidden (cleaner remount)
    vscode.window.registerWebviewViewProvider(
      ElementPickerPanelProvider.viewType,
      panel,
      { webviewOptions: { retainContextWhenHidden: false } }
    ),
    onDidChangeLanguage(() => {
      onLanguageChange();
    }),
    vscode.commands.registerCommand("elementPicker.openPanel", async () => {
      // Prefer durable Controls tree; fall back to webview tab
      try {
        await vscode.commands.executeCommand(
          `${ControlsTreeProvider.viewId}.focus`
        );
      } catch {
        await vscode.commands.executeCommand("elementPicker.panel.focus");
      }
    }),
    vscode.commands.registerCommand("elementPicker.showMenu", async () => {
      try {
        await showActionMenu(panelState());
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.openEditorPanel", () => {
      editorPanel.show(panelState());
    }),
    vscode.commands.registerCommand("elementPicker.reloadWebview", () => {
      panel.forceRemount();
      void vscode.window.showInformationMessage(t("msgWebviewReloaded"));
    }),
    vscode.commands.registerCommand(
      "elementPicker.copyLocalChromeCmd",
      async () => {
        const url = (await askUrl(session.currentUrl || defaultUrl())) || "";
        if (!url) return;
        const finalUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;
        const cmd = BrowserSession.localChromeDebugCommand(finalUrl, 9222);
        await vscode.env.clipboard.writeText(cmd);
        void vscode.window.showInformationMessage(t("msgLocalChromeStarted"));
      }
    ),
    vscode.commands.registerCommand(
      "elementPicker.startLocalChrome",
      async () => {
        const url = (await askUrl(session.currentUrl || defaultUrl())) || "";
        if (!url) return;
        const finalUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;
        const cmd = BrowserSession.localChromeDebugCommand(finalUrl, 9222);
        await vscode.env.clipboard.writeText(cmd);

        // Local workspace only: run PowerShell to start Chrome with CDP
        if (process.platform === "win32" && !vscode.env.remoteName) {
          try {
            const ps1 = path.join(os.tmpdir(), "davinci-start-chrome.ps1");
            fs.writeFileSync(ps1, cmd, "utf8");
            const term = vscode.window.createTerminal({
              name: "DaVinchi Local Chrome",
              shellPath: "powershell.exe",
            });
            term.show(true);
            term.sendText(
              `powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`
            );
          } catch {
            /* clipboard is enough */
          }
        }

        void vscode.window.showInformationMessage(
          t("msgLocalChromeStarted") +
            (vscode.env.remoteName ? "\n\n" + t("cdpReversePortHint") : "")
        );
      }
    ),
    vscode.commands.registerCommand("elementPicker.selectLanguage", async () => {
      try {
        const locale = await pickAndSaveLanguage();
        if (locale) {
          // configuration listener will refresh UI
        }
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.openBrowser", async () => {
      try {
        const url = await askUrl();
        if (url === undefined) return;
        await openBrowser(url);
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.toggleSelect", async () => {
      try {
        await toggleSelect();
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.attachLast", async () => {
      try {
        await attachLast();
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.copyLast", async () => {
      try {
        await copyLast();
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.closeBrowser", async () => {
      try {
        await closeBrowser();
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand("elementPicker.openLastFolder", async () => {
      try {
        await openLastFolder();
      } catch (e) {
        showErr(e);
      }
    }),
    statusBar,
    {
      dispose: () => {
        editorPanel.dispose();
        void session.close();
      },
    }
  );

  syncUi();
}

export async function deactivate(): Promise<void> {
  await session?.close();
}
