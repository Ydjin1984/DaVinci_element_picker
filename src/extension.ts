import * as vscode from "vscode";
import type { Page } from "playwright-core";
import {
  BrowserSession,
  ensureBrowserPathSetting,
} from "./browser/browserSession";
import { spawn } from "child_process";
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
  affectsCloneOptions,
  getCloneOptions,
} from "./storage/cloneOptions";
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
import { getHostInfo, initHostInfo } from "./hostInfo";

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
  const host = getHostInfo();
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
    versionBadge: host.badge,
    versionDetail: host.detail,
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
    const short = err.split("\n")[0] || err;
    syncUi(t("statusError", short), "error");
    // Short non-modal error only — no forced PowerShell dump / CDP wizard on Open
    void vscode.window.showErrorMessage(t("errPrefix", short));
    return;
  } finally {
    openingBrowser = false;
  }

  await ensureGitignoreEntry();
  syncUi(t("statusBrowserOpenUrl", finalUrl));
  void vscode.window.showInformationMessage(t("msgBrowserOpened"));
}

/** Start Chrome on the local Windows PC (UI host), even under Remote SSH. */
async function startLocalChromeProcess(finalUrl: string): Promise<void> {
  const cmd = BrowserSession.localChromeDebugCommand(finalUrl, 9222);
  await vscode.env.clipboard.writeText(cmd);
  // UI host stays win32 when Remote SSH is open — do NOT require !remoteName.
  // spawn() runs on THIS extension-host process (the local PC for a UI
  // extension); createTerminal in a remote window may open a REMOTE shell,
  // where powershell.exe does not exist (same pattern as webviewRepair.ts).
  if (process.platform === "win32") {
    try {
      const ps1 = path.join(os.tmpdir(), "davinci-start-chrome.ps1");
      fs.writeFileSync(ps1, cmd, "utf8");
      spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-WindowStyle",
          "Hidden",
          "-File",
          ps1,
        ],
        { detached: true, stdio: "ignore", windowsHide: true }
      ).unref();
    } catch {
      /* clipboard is enough */
    }
  }
  void vscode.window.showInformationMessage(
    t("msgLocalChromeStarted") +
      (vscode.env.remoteName ? "\n\n" + t("cdpReversePortHint") : "")
  );
}

/**
 * Copyable recovery steps for a mis-hosted install (extension on the SSH
 * server instead of the local PC). English on purpose: pasted into docs,
 * issues and terminals.
 */
function workspaceHostFixSteps(): string {
  const vsix = `element-picker-${getHostInfo().version}.vsix`;
  return [
    "# DaVinchi is running on the REMOTE host (workspace · linux) — Chrome cannot start on your PC.",
    "",
    "# Fix A (recommended) — force UI host + local VSIX",
    "1) Open Command Palette → Preferences: Open User Settings (JSON)  [on your LOCAL PC]",
    "2) Add (merge if remote.extensionKind already exists):",
    '   "remote.extensionKind": {',
    '     "coin-rebalancer.element-picker": ["ui"]',
    "   }",
    "3) Install the VSIX on your LOCAL PC (not from the SSH window):",
    `   cursor --install-extension path\\to\\${vsix} --force`,
    "   (or code --install-extension … --force)",
    "4) Reconnect SSH → Developer: Reload Window.",
    "5) Badge in DaVinchi panel MUST show:  v… · ui · win32   (not workspace · linux).",
    "",
    "# Fix A2 — still 'workspace' after the reload? Remove the SERVER copy",
    "In the SSH window: Extensions → filter DaVinchi → the entry listed under",
    '"SSH: <host> — Installed" → Uninstall. Keep the Local install. Then Reload Window.',
    "Manual equivalent in the SSH terminal (both server runtimes):",
    "   rm -rf ~/.vscode-server/extensions/coin-rebalancer.element-picker-*",
    "   rm -rf ~/.cursor-server/extensions/coin-rebalancer.element-picker-*",
    "(the editor rewrites its extensions.json on the next connect)",
    "",
    "# Fix B (advanced CDP) — only if the extension must stay on the server:",
    "1) On Windows PowerShell (local PC, not SSH terminal), run the script from",
    "   “DaVinchi: Copy Local Chrome CDP Command”.",
    "2) In Cursor/VS Code: Ports → Forward / reverse 9222 → 9222,",
    "   or reconnect:  ssh -R 9222:127.0.0.1:9222 <host>",
    "3) Open browser again (browserMode auto|cdp).",
  ].join("\n");
}

const EXT_ID = "coin-rebalancer.element-picker";
/** Remembers that the UI override was already written from this host. */
const FORCED_UI_KEY = "davinchi.forcedUiExtensionKind";

type ForcedUiResult = "forced" | "already" | "failed";

/**
 * Force this extension onto the local UI host under Remote SSH/Cursor.
 * Package already declares extensionKind:ui, but Cursor/VS Code still
 * sometimes activate a remote workspace copy — remote.extensionKind wins.
 *
 * "already" means writing it again cannot help — the server-side copy has to
 * go instead. A remembered previous attempt counts as "already" even when the
 * setting reads back as unset: `remote.extensionKind` is application-scoped,
 * so a remote extension host may never see the value that lives in the local
 * User settings, and re-writing it every activation would loop the toast.
 */
async function ensureForcedUiExtensionKind(
  memento: vscode.Memento
): Promise<ForcedUiResult> {
  const cfg = vscode.workspace.getConfiguration();
  const isUi = (entry: string | string[] | undefined): boolean =>
    entry === "ui" ||
    (Array.isArray(entry) && entry.length === 1 && entry[0] === "ui");

  const effective =
    cfg.get<Record<string, string | string[]>>("remote.extensionKind") || {};
  if (isUi(effective[EXT_ID]) || memento.get<boolean>(FORCED_UI_KEY, false)) {
    return "already";
  }
  // Merge onto the user's OWN value, never onto get()'s effective object —
  // that one carries VS Code's schema default {"pub.name": ["ui"]} and would
  // persist that placeholder into settings.json.
  const own =
    cfg.inspect<Record<string, string | string[]>>("remote.extensionKind")
      ?.globalValue || {};
  try {
    await cfg.update(
      "remote.extensionKind",
      { ...own, [EXT_ID]: ["ui"] },
      vscode.ConfigurationTarget.Global
    );
  } catch {
    return "failed";
  }
  await memento.update(FORCED_UI_KEY, true);
  return "forced";
}

/** Loud warning when the extension landed on the SSH server (workspace host). */
function warnIfWorkspaceHosted(
  host: {
    extensionKind: "ui" | "workspace";
    badge: string;
  },
  memento: vscode.Memento
): void {
  if (
    host.extensionKind !== "workspace" ||
    !vscode.env.remoteName ||
    vscode.env.remoteName === "wsl" ||
    process.platform === "win32" ||
    process.platform === "darwin"
  ) {
    return;
  }

  void (async () => {
    const result = await ensureForcedUiExtensionKind(memento);
    const copyLabel = t("actionCopyFixSteps");
    const reloadLabel = t("actionReloadWindow");
    const msg =
      result === "forced"
        ? t("msgWorkspaceHostForcedUi", host.badge)
        : result === "already"
          ? t("msgWorkspaceHostStillRemote", host.badge)
          : t("msgWorkspaceHostWarning", host.badge);
    // Reload only helps right after the override was written; once it is
    // already set, offering Reload again just loops the same toast.
    const actions =
      result === "forced" ? [reloadLabel, copyLabel] : [copyLabel];
    const choice = await vscode.window.showWarningMessage(msg, ...actions);
    if (choice === copyLabel) {
      await vscode.env.clipboard.writeText(workspaceHostFixSteps());
      return;
    }
    if (choice === reloadLabel) {
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }
  })();
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
        session.downloadUrl(url, { maxBytes: 6 * 1024 * 1024 })
      );
      lastPick = saved;

      // One-shot: clone mode deactivates itself after a successful capture
      if (getCloneOptions().oneShot && session.isCloneMode) {
        try {
          await session.setCloneMode(false);
        } catch {
          /* page may be closed or navigating */
        }
      }

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
  const host = initHostInfo(context);
  session = new BrowserSession();
  statusBar = new StatusBarController();

  session.setPickHandler(handlePick);
  session.setModeHandler(() => syncUi());
  session.setCloneModeHandler(() => syncUi());

  // Quiet diagnostics only (no popups on activate)
  console.log(
    "[DaVinchi] activate",
    host.detail,
    "| extensionKind=",
    host.extensionKind,
    "| remoteName=",
    vscode.env.remoteName || "(local)",
    "| uiKind=",
    vscode.env.uiKind
  );

  // Exception to "no popups": a mis-hosted install (extension on the SSH
  // server) makes Open Browser dead on arrival — warn once, with copy-steps.
  warnIfWorkspaceHosted(host, context.globalState);

  // Resolve Chrome/Edge path on the UI host (clears poisoned Playwright paths)
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
    // Clone options changed (panel checkbox or settings UI) → refresh panel
    // checkboxes and push the full-site flag into the live page
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (affectsCloneOptions(e)) {
        void session.applyCloneOptions();
        syncUi();
      }
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
        // Runs on UI host (local Windows) even when Remote SSH workspace is open
        await startLocalChromeProcess(normalizeUrl(url));
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
