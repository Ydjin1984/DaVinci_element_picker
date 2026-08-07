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
import { saveClonePack } from "./storage/cloneStore";
import {
  ensureGitignoreEntry,
  getLatestPaths,
  savePick,
} from "./storage/pickStore";
import {
  isClonePayload,
  type ElementPickPayload,
  type SavedPick,
} from "./types";
import { showActionMenu } from "./ui/actionMenu";
import { ControlsTreeProvider } from "./ui/controlsTree";
import { EditorControlPanel } from "./ui/editorPanel";
import {
  ElementPickerPanelProvider,
  type PanelState,
  type StatusKind,
} from "./ui/panel";
import { StatusBarController } from "./ui/statusBar";
import { fixWebviewCache } from "./ui/webviewRepair";

let session: BrowserSession;
let lastPick: SavedPick | null = null;
let panel: ElementPickerPanelProvider;
let controlsTree: ControlsTreeProvider;
let editorPanel: EditorControlPanel;
let statusBar: StatusBarController;
let pickingLock = false;
let openingBrowser = false;

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

/** Prepend http:// only when no scheme at all (keeps file://, https://, etc.). */
function normalizeUrl(target: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) ? target : `http://${target}`;
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
    cloneMode: session.isCloneMode,
    currentUrl: session.currentUrl || defaultUrl(),
    lastPick,
    status: session.isOpen
      ? session.isCloneMode
        ? t("statusCloneOn")
        : session.isSelectMode
          ? t("statusSelectOn")
          : t("statusBrowserOpen")
      : lastPick
        ? t("statusLastPick", lastPick.selector)
        : t("statusReady"),
    statusKind: session.isOpen ? "ok" : "idle",
  };
}

function syncUi(extraStatus?: string, kind?: StatusKind): void {
  const st = panelState();
  if (extraStatus) {
    st.status = extraStatus;
  }
  if (kind) {
    st.statusKind = kind;
  }
  panel.updateState(st);
  controlsTree?.refresh(st);
  if (session.isOpen) {
    statusBar.setBrowserOpen(session.isSelectMode, session.isCloneMode);
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

/** True when the browser-open error should route to the CDP wizard. */
function isCdpFailure(e: unknown, message: string): boolean {
  const kind = (e as { davinchiErrorKind?: string } | null)?.davinchiErrorKind;
  if (kind) {
    return kind === "cdp";
  }
  // Fallback for errors without a kind: only unambiguous CDP signals
  return (
    message.includes("ECONNREFUSED 127.0.0.1:9222") ||
    message.includes("Remote SSH")
  );
}

async function openBrowser(url?: string): Promise<void> {
  if (openingBrowser) {
    return;
  }
  let target = (url || "").trim();
  if (!target) {
    const answer = await askUrl();
    if (answer === undefined) {
      return; // user pressed Esc — not an error
    }
    target = answer;
  }
  if (!target) {
    throw new Error(t("errUrlEmpty"));
  }
  const finalUrl = normalizeUrl(target);

  openingBrowser = true;
  syncUi(t("msgOpening", finalUrl), "busy");
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
    syncUi(t("statusError", err.split("\n")[0] || err), "error");
    if (isCdpFailure(e, err)) {
      // Remote CDP not ready → guided retry loop
      openingBrowser = false;
      await handleCdpConnectFailure(finalUrl, err);
      return;
    }
    throw e;
  } finally {
    openingBrowser = false;
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
      syncUi(t("msgOpening", finalUrl), "busy");
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
        syncUi(t("statusError", err.split("\n")[0] || err), "error");
        throw e;
      }
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
    return false; // user cancelled the URL prompt
  }
  const on = await session.toggleSelectMode();
  syncUi(on ? t("statusSelectOnHover") : t("statusSelectOff"));
  return on;
}

async function toggleClone(): Promise<boolean> {
  if (!session.isOpen) {
    await openBrowser();
  }
  if (!session.isOpen) {
    return false; // user cancelled the URL prompt
  }
  const on = await session.toggleCloneMode();
  syncUi(on ? t("statusCloneOnHover") : t("statusCloneOff"));
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
    if (isClonePayload(payload) || payload.captureMode === "clone") {
      syncUi(t("statusCloning", payload.selector), "busy");
      const shots = await session.screenshotClonePack(payload);
      const clonePayload = isClonePayload(payload)
        ? payload
        : ({ ...payload, captureMode: "clone" } as import("./types").ElementClonePayload);

      // Ensure minimum clone fields if payload was partial
      const full = {
        ...clonePayload,
        captureMode: "clone" as const,
        subtreeHTML:
          (clonePayload as import("./types").ElementClonePayload).subtreeHTML ||
          payload.outerHTML ||
          "",
        subtreeTruncated:
          (clonePayload as import("./types").ElementClonePayload)
            .subtreeTruncated ?? false,
        ancestors:
          (clonePayload as import("./types").ElementClonePayload).ancestors ||
          [],
        parentDimensions:
          (clonePayload as import("./types").ElementClonePayload)
            .parentDimensions ?? null,
        pageMetrics: (clonePayload as import("./types").ElementClonePayload)
          .pageMetrics || {
          scrollWidth: 0,
          scrollHeight: 0,
          viewportWidth: 0,
          viewportHeight: 0,
        },
        deepCssText:
          (clonePayload as import("./types").ElementClonePayload).deepCssText ||
          payload.cssText ||
          "",
        keyframesCss:
          (clonePayload as import("./types").ElementClonePayload)
            .keyframesCss || "",
        fontFaceCss:
          (clonePayload as import("./types").ElementClonePayload).fontFaceCss ||
          "",
        motionStyles:
          (clonePayload as import("./types").ElementClonePayload)
            .motionStyles || {},
        fonts:
          (clonePayload as import("./types").ElementClonePayload).fonts || [],
        assets:
          (clonePayload as import("./types").ElementClonePayload).assets || [],
        styleTree:
          (clonePayload as import("./types").ElementClonePayload).styleTree ||
          [],
        inlineSvgs:
          (clonePayload as import("./types").ElementClonePayload).inlineSvgs ||
          [],
        canvasDataUrls:
          (clonePayload as import("./types").ElementClonePayload)
            .canvasDataUrls || [],
        pseudoElements:
          (clonePayload as import("./types").ElementClonePayload)
            .pseudoElements || {},
        deepCssVariables:
          (clonePayload as import("./types").ElementClonePayload)
            .deepCssVariables ||
          payload.cssVariables ||
          {},
        headLinks:
          (clonePayload as import("./types").ElementClonePayload).headLinks ||
          [],
      };

      const saved = await saveClonePack(full, shots, (url) =>
        session.downloadUrl(url)
      );
      lastPick = saved;

      if (autoAttach()) {
        await attachEverywhere(saved);
        syncUi(t("statusCloneSavedAttached", payload.selector, saved.timestamp));
        void vscode.window.showInformationMessage(
          t("msgCloneSavedAttached", payload.selector)
        );
      } else {
        syncUi(t("statusCloneSaved", payload.selector, saved.timestamp));
        void vscode.window.showInformationMessage(
          t("msgCloneSavedManual", payload.selector)
        );
      }
      return;
    }

    syncUi(t("statusCapturing", payload.selector), "busy");
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
    syncUi(t("statusPickFailed", err), "error");
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
    statusBar.setBrowserOpen(session.isSelectMode, session.isCloneMode);
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
  session.setCloneModeHandler(() => syncUi());

  // Pin system Chrome/Edge path so Playwright uses a real executable
  void ensureBrowserPathSetting().then((p) => {
    if (p) {
      console.log(
        "[DaVinchi] browserPath →",
        p,
        "| remoteName=",
        vscode.env.remoteName || "(local)",
        "| uiKind=",
        vscode.env.uiKind
      );
    }
  });

  panel = new ElementPickerPanelProvider(context.extensionUri, {
    openBrowser,
    toggleSelect,
    toggleClone,
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
        statusBar.setBrowserOpen(session.isSelectMode, session.isCloneMode);
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
    vscode.commands.registerCommand("elementPicker.fixWebviewCache", async () => {
      try {
        await fixWebviewCache(context);
      } catch (e) {
        showErr(e);
      }
    }),
    vscode.commands.registerCommand(
      "elementPicker.copyLocalChromeCmd",
      async () => {
        const url = (await askUrl(session.currentUrl || defaultUrl())) || "";
        if (!url) return;
        const finalUrl = normalizeUrl(url);
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
        const finalUrl = normalizeUrl(url);
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
    vscode.commands.registerCommand("elementPicker.toggleClone", async () => {
      try {
        await toggleClone();
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
