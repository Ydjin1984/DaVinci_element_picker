import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type LaunchOptions,
  type Page,
} from "playwright-core";
import { getHostInfo } from "../hostInfo";
import { t } from "../i18n";
import { getCloneOptions } from "../storage/cloneOptions";
import type { BrowserChannel, ElementPickPayload } from "../types";
import {
  getHideForCaptureSource,
  getPickerBootstrapSource,
  getRestoreAfterCaptureSource,
  getSetCloneModeSource,
  getSetCloneOptionsSource,
  getSetModeSource,
} from "./pickerInject";

export type PickHandler = (payload: ElementPickPayload, page: Page) => void | Promise<void>;
export type ModeHandler = (on: boolean) => void;

/** True when path looks like a Playwright / Chrome-for-Testing cache binary. */
function isPlaywrightCachePath(executablePath: string): boolean {
  const n = executablePath.replace(/\\/g, "/").toLowerCase();
  return (
    n.includes("/ms-playwright/") ||
    n.includes("/.cache/ms-playwright/") ||
    n.includes("/chrome-for-testing/") ||
    /\/chromium-\d+\//.test(n)
  );
}

/**
 * Real system Chrome/Edge only (not Playwright cache).
 * Playwright binaries on Linux SSH often miss GUI libs and have no DISPLAY —
 * pinning them breaks Remote SSH until the user clears browserPath.
 */
export function findPreferredBrowserPath(): string {
  const list = discoverBrowserExecutables({ includePlaywright: false });
  const chrome = list.find((x) => x.label === "chrome");
  if (chrome) return chrome.executablePath;
  const edge = list.find((x) => x.label === "msedge");
  if (edge) return edge.executablePath;
  return list[0]?.executablePath || "";
}

/**
 * Resolve a usable Chrome/Edge path. Never pin Playwright-cache paths.
 * On Remote SSH workspace hosts (Linux, no DISPLAY) do not suggest a server binary —
 * Chrome must run on the local UI PC (or attach via CDP).
 * Does not write User settings (explicit browserPath only).
 */
export async function ensureBrowserPathSetting(): Promise<string> {
  const cfg = vscode.workspace.getConfiguration("elementPicker");
  const current = (cfg.get<string>("browserPath", "") || "").trim();

  // Clear poisoned remote/playwright paths so auto-launch can recover
  if (current && (isPlaywrightCachePath(current) || !fs.existsSync(current))) {
    try {
      await cfg.update("browserPath", "", vscode.ConfigurationTarget.Global);
    } catch {
      /* ignore */
    }
  } else if (
    current &&
    fs.existsSync(current) &&
    !isPlaywrightCachePath(current)
  ) {
    return current;
  }

  // Remote SSH workspace host: do not return a server-side binary as
  // "preferred" — even with DISPLAY set (mis-hosted install), the pick
  // window belongs on the user's local PC (review nit N1).
  if (isRemoteHeadlessEnvironment() || isRemoteLinuxWorkspaceHost()) {
    return "";
  }

  return findPreferredBrowserPath();
}

/** Remote workspace extension host without a GUI (typical SSH Linux server). */
function isRemoteHeadlessEnvironment(): boolean {
  return (
    !!vscode.env.remoteName &&
    process.platform === "linux" &&
    !process.env.DISPLAY
  );
}

/**
 * Extension host is a remote Linux WORKSPACE host (SSH server / container) —
 * even when DISPLAY is set (X11/VNC): a server-side browser window is never
 * what a user at a local monitor wants for interactive pick, so prefer CDP to
 * their local Chrome. The extensionKind check keeps a Linux DESKTOP acting as
 * the UI host (VS Code/Cursor on Linux + Remote SSH) on the normal local
 * launch path. WSL is excluded (WSLg windows appear on the local desktop).
 */
function isRemoteLinuxWorkspaceHost(): boolean {
  return (
    !!vscode.env.remoteName &&
    vscode.env.remoteName !== "wsl" &&
    process.platform === "linux" &&
    getHostInfo().extensionKind === "workspace"
  );
}

/** Resolve symlinks / which(1) style names when present. */
function pushIfExists(
  out: Array<{ label: string; executablePath: string }>,
  seen: Set<string>,
  label: string,
  executablePath: string
): void {
  if (!executablePath) return;
  try {
    let p = executablePath;
    if (!fs.existsSync(p)) return;
    try {
      p = fs.realpathSync(p);
    } catch {
      /* keep original */
    }
    const key = p.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, executablePath: p });
  } catch {
    /* ignore */
  }
}

/** Playwright browser cache root for this platform (honors PLAYWRIGHT_BROWSERS_PATH). */
function playwrightCacheRoot(): string {
  const envRoot = (process.env.PLAYWRIGHT_BROWSERS_PATH || "").trim();
  if (envRoot && envRoot !== "0") {
    return envRoot;
  }
  const home = os.homedir();
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(local, "ms-playwright");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Caches", "ms-playwright");
  }
  return path.join(home, ".cache", "ms-playwright");
}

/** Common install locations for system Chrome / Edge (Windows user-local, Linux, macOS). */
function discoverBrowserExecutables(
  opts: { includePlaywright?: boolean } = {}
): Array<{ label: string; executablePath: string }> {
  const includePlaywright = opts.includePlaywright !== false;
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const seen = new Set<string>();
  const out: Array<{ label: string; executablePath: string }> = [];

  const candidates: Array<{ label: string; executablePath: string }> = [
    // Windows Chrome — user install first (most common)
    {
      label: "chrome",
      executablePath: path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    },
    {
      label: "chrome",
      executablePath: path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
    },
    {
      label: "chrome",
      executablePath: path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    },
    // Windows Edge
    {
      label: "msedge",
      executablePath: path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
    },
    {
      label: "msedge",
      executablePath: path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
    },
    {
      label: "msedge",
      executablePath: path.join(local, "Microsoft", "Edge", "Application", "msedge.exe"),
    },
    // macOS
    {
      label: "chrome",
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    {
      label: "msedge",
      executablePath:
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    },
    // Linux system packages (not user wrappers pointing at Playwright)
    { label: "chrome", executablePath: "/usr/bin/google-chrome-stable" },
    { label: "chrome", executablePath: "/usr/bin/google-chrome" },
    { label: "chrome", executablePath: "/usr/bin/chromium-browser" },
    { label: "chrome", executablePath: "/usr/bin/chromium" },
    { label: "chrome", executablePath: "/snap/bin/chromium" },
    { label: "chrome", executablePath: "/usr/bin/chrome" },
    { label: "msedge", executablePath: "/usr/bin/microsoft-edge" },
    { label: "msedge", executablePath: "/usr/bin/microsoft-edge-stable" },
  ];

  for (const c of candidates) {
    pushIfExists(out, seen, c.label, c.executablePath);
  }

  // Drop Playwright-cache paths that snuck in via realpath (e.g. ~/.local/bin wrapper)
  for (let i = out.length - 1; i >= 0; i--) {
    const p = out[i].executablePath;
    if (isPlaywrightCachePath(p)) {
      out.splice(i, 1);
      continue;
    }
    try {
      const st = fs.statSync(p);
      // Tiny shell scripts wrapping Playwright — not a real browser binary
      if (st.size < 4096) {
        const body = fs.readFileSync(p, "utf8").slice(0, 500);
        if (
          body.startsWith("#!") &&
          (body.includes("ms-playwright") || body.includes("chrome-linux"))
        ) {
          out.splice(i, 1);
        }
      }
    } catch {
      /* keep */
    }
  }

  if (!includePlaywright) {
    return out;
  }

  // Scan playwright cache for any chrome binary (linux/mac/win) — last resort only
  try {
    const pw = playwrightCacheRoot();
    if (fs.existsSync(pw)) {
      for (const name of fs.readdirSync(pw)) {
        if (!name.startsWith("chromium")) continue;
        const guesses = [
          path.join(pw, name, "chrome-linux64", "chrome"),
          path.join(pw, name, "chrome-linux", "chrome"),
          path.join(pw, name, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
          path.join(pw, name, "chrome-win64", "chrome.exe"),
          path.join(pw, name, "chrome-win", "chrome.exe"),
        ];
        for (const g of guesses) {
          pushIfExists(out, seen, "chromium", g);
        }
      }
    }
  } catch {
    /* ignore */
  }

  return out;
}

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private selectMode = false;
  private cloneMode = false;
  private onPick: PickHandler | null = null;
  private onModeChange: ModeHandler | null = null;
  private onCloneModeChange: ModeHandler | null = null;
  private navHooked = false;
  private exposed = false;
  /** Connected to user's existing Chrome via CDP — do not kill Chrome on close. */
  private viaCdp = false;
  /**
   * Serialized open queue: concurrent open(url) keeps only the latest URL
   * and always navigates to it after the in-flight open finishes.
   */
  private openChain: Promise<void> = Promise.resolve();
  private pendingOpenUrl: string | null = null;

  get isOpen(): boolean {
    return !!this.page && !this.page.isClosed();
  }

  get isSelectMode(): boolean {
    return this.selectMode;
  }

  get isCloneMode(): boolean {
    return this.cloneMode;
  }

  get isPickingActive(): boolean {
    return this.selectMode || this.cloneMode;
  }

  get currentUrl(): string {
    try {
      return this.page?.url() ?? "";
    } catch {
      return "";
    }
  }

  setPickHandler(handler: PickHandler | null): void {
    this.onPick = handler;
  }

  setModeHandler(handler: ModeHandler | null): void {
    this.onModeChange = handler;
  }

  setCloneModeHandler(handler: ModeHandler | null): void {
    this.onCloneModeChange = handler;
  }

  private channel(): BrowserChannel {
    const ch = vscode.workspace
      .getConfiguration("elementPicker")
      .get<string>("browserChannel", "chrome");
    if (ch === "msedge" || ch === "chromium" || ch === "chrome") {
      return ch;
    }
    return "chrome";
  }

  private configuredBrowserPath(): string {
    // Defense in depth: never launch a workspace-injected binary in Restricted Mode
    // (settings are also application-scoped in package.json).
    if (!vscode.workspace.isTrusted) {
      return "";
    }
    const raw = (
      vscode.workspace
        .getConfiguration("elementPicker")
        .get<string>("browserPath", "") || ""
    ).trim();
    // Ignore Playwright-cache paths — they are not a real desktop Chrome for pick.
    if (!raw || isPlaywrightCachePath(raw)) {
      return "";
    }
    return raw;
  }

  private browserMode(): "auto" | "cdp" | "launch" {
    const m = vscode.workspace
      .getConfiguration("elementPicker")
      .get<string>("browserMode", "auto");
    if (m === "cdp" || m === "launch" || m === "auto") return m;
    return "auto";
  }

  private cdpEndpoint(): string {
    return (
      vscode.workspace
        .getConfiguration("elementPicker")
        .get<string>("cdpEndpoint", "http://127.0.0.1:9222") ||
      "http://127.0.0.1:9222"
    ).trim();
  }

  isRemoteHost(): boolean {
    return !!vscode.env.remoteName;
  }

  /**
   * PowerShell script for the USER'S WINDOWS PC (always), even when extension
   * host is Remote SSH Linux. Starts Chrome with --remote-debugging-port.
   * Chrome is searched in every standard install location FIRST; Edge is a
   * last-resort fallback only (the old 2-path probe kept starting Edge for
   * users whose Chrome lives in Program Files (x86) or a custom dir).
   */
  static localChromeDebugCommand(url: string, port = 9222): string {
    // Quote-strip + drop control chars so the PowerShell single-quoted string stays safe.
    const sanitize = (s: string): string =>
      s
        .replace(/["']/g, "")
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim();
    const safeUrl = sanitize(url);
    // Explicit browserPath wins when it points at a Windows executable —
    // the script always runs on the local Windows PC.
    const cfgPath = sanitize(
      vscode.workspace
        .getConfiguration("elementPicker")
        .get<string>("browserPath", "") || ""
    );
    const custom = /^[a-zA-Z]:[\\/]/.test(cfgPath) ? cfgPath : "";
    return [
      `# DaVinchi — run this on your WINDOWS PC (local Chrome for remote SSH picks)`,
      `$port = ${port}`,
      `$url = '${safeUrl}'`,
      `$candidates = @(`,
      ...(custom ? [`  '${custom}',`] : []),
      `  (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe'),`,
      `  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',`,
      `  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',`,
      `  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',`,
      `  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',`,
      `  (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\Application\\msedge.exe')`,
      `)`,
      `$chrome = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1`,
      `if (-not $chrome) { throw 'Chrome/Edge not found. Install Google Chrome.' }`,
      `if ($chrome -like '*msedge*') { Write-Host 'NOTE: Chrome not found in standard locations — starting Edge instead.' }`,
      `$dir = Join-Path $env:TEMP 'davinci-chrome-profile'`,
      `New-Item -ItemType Directory -Force -Path $dir | Out-Null`,
      `Write-Host "Starting: $chrome"`,
      `Write-Host "CDP port: $port  URL: $url"`,
      `Start-Process -FilePath $chrome -ArgumentList @(`,
      `  "--remote-debugging-port=$port",`,
      `  "--user-data-dir=$dir",`,
      `  '--no-first-run',`,
      `  '--no-default-browser-check',`,
      `  $url`,
      `)`,
      `Write-Host 'OK — keep this Chrome open. In Cursor/VS Code Remote: reverse-forward port' $port`,
      `Write-Host 'Then DaVinchi → Open browser (connects via CDP, picks save into SSH workspace).'`,
    ].join("\r\n");
  }

  /**
   * Connect to an already-running Chrome (local PC) over CDP.
   * On Remote SSH: start Chrome on Windows with --remote-debugging-port=9222,
   * then reverse-forward remote:9222 → local:9222 (or SSH RemoteForward).
   */
  private async connectCdp(
    endpoint: string
  ): Promise<{ browser: Browser; how: string }> {
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 });
    return { browser, how: `cdp=${endpoint}` };
  }

  /**
   * Launch system Chrome/Edge on the extension-host machine.
   */
  private async launchLocalBrowser(): Promise<{ browser: Browser; how: string }> {
    const channel = this.channel();
    const launchArgs = [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--window-position=0,0",
      "--no-first-run",
      "--no-default-browser-check",
      // Linux servers / containers
      "--disable-dev-shm-usage",
    ];
    // If no DISPLAY on Linux, still try headful first (user wants a window);
    // headless is useless for element pick.

    const attempts: Array<{ how: string; opts: LaunchOptions }> = [];
    const prefer = channel === "msedge" ? "msedge" : "chrome";

    const custom = this.configuredBrowserPath();
    if (custom && !isPlaywrightCachePath(custom)) {
      if (!fs.existsSync(custom)) {
        throw new Error(
          `elementPicker.browserPath not found:\n  ${custom}\n` +
            `Fix the path to chrome.exe / google-chrome / msedge.`
        );
      }
      attempts.push({
        how: `browserPath=${custom}`,
        opts: { headless: false, executablePath: custom, args: launchArgs },
      });
    }

    // Paths FIRST — prefer real system Chrome/Edge over Playwright cache.
    const discovered = discoverBrowserExecutables({
      includePlaywright: true,
    }).sort((a, b) => {
      const aPw = isPlaywrightCachePath(a.executablePath) ? 1 : 0;
      const bPw = isPlaywrightCachePath(b.executablePath) ? 1 : 0;
      if (aPw !== bPw) return aPw - bPw;
      if (a.label === prefer && b.label !== prefer) return -1;
      if (b.label === prefer && a.label !== prefer) return 1;
      return 0;
    });
    for (const d of discovered) {
      attempts.push({
        how: `path=${d.executablePath}`,
        opts: {
          headless: false,
          executablePath: d.executablePath,
          args: launchArgs,
        },
      });
    }

    // Playwright channel (uses OS registration; can fail on Linux servers)
    if (channel === "chrome" || channel === "msedge") {
      attempts.push({
        how: `channel=${channel}`,
        opts: { headless: false, channel, args: launchArgs },
      });
    }
    for (const fb of ["chrome", "msedge"] as const) {
      if (fb === channel) continue;
      attempts.push({
        how: `channel=${fb}`,
        opts: { headless: false, channel: fb, args: launchArgs },
      });
    }

    // Playwright Chromium last resort — only on desktop hosts with a GUI.
    // Never treat it as primary on Remote SSH Linux (no window for interactive pick).
    if (!isRemoteHeadlessEnvironment() && channel === "chromium") {
      attempts.push({
        how: "playwright-chromium",
        opts: { headless: false, args: launchArgs },
      });
    }

    const errors: string[] = [];
    for (const attempt of attempts) {
      try {
        const browser = await chromium.launch(attempt.opts);
        // Notify when Playwright channel fell back to a different browser.
        const m = /^channel=(chrome|msedge|chromium)$/.exec(attempt.how);
        if (m && m[1] !== channel) {
          void vscode.window.showInformationMessage(
            t("browserChannelFallback", m[1], channel)
          );
        }
        return { browser, how: attempt.how };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // collapse long playwright boxes
        const short = msg.replace(/\s+/g, " ").slice(0, 220);
        errors.push(`${attempt.how}: ${short}`);
      }
    }

    const found =
      discovered.map((d) => d.executablePath).join("\n  ") || "(none found on this machine)";
    const remote = vscode.env.remoteName
      ? `Remote host: ${vscode.env.remoteName}\n`
      : "";
    const platform = `${process.platform} ${os.arch()} home=${os.homedir()}`;

    throw new Error(
      `Could not launch a browser on the extension host.\n` +
        remote +
        `Platform: ${platform}\n` +
        `Found browsers:\n  ${found}\n\n` +
        `Recommended (Remote SSH): use LOCAL Chrome via CDP — command\n` +
        `  “DaVinchi: Start Local Chrome (CDP)”\n` +
        `then reverse-forward port 9222 and Open browser again (browserMode=auto|cdp).\n\n` +
        `Attempts:\n  ${errors.slice(0, 8).join("\n  ")}`
    );
  }

  /**
   * Obtain a browser.
   *
   * DaVinchi is a **UI** extension: the host is the local PC even under Remote SSH
   * (`remoteName` may be set, but `process.platform` is win32/darwin). Always launch
   * system Chrome/Edge on that local host first — same as 0.1.22.
   *
   * CDP is only a fallback (or explicit browserMode=cdp). Never prefer server-side
   * Playwright Chromium on a headless Linux workspace host.
   */
  private async obtainBrowser(): Promise<{
    browser: Browser;
    how: string;
    viaCdp: boolean;
  }> {
    const mode = this.browserMode();
    const endpoint = this.cdpEndpoint();
    // Mis-hosted on the SSH server (should be a UI extension): prefer CDP to
    // the user's local Chrome even when DISPLAY is set — an X11/VNC window on
    // the server is never the interactive pick surface the user asked for.
    const cdpFirst = isRemoteLinuxWorkspaceHost();
    const errors: string[] = [];

    const tryLaunch = async (): Promise<{
      browser: Browser;
      how: string;
      viaCdp: boolean;
    } | null> => {
      try {
        const r = await this.launchLocalBrowser();
        return { ...r, viaCdp: false };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`launch: ${msg.replace(/\s+/g, " ").slice(0, 240)}`);
        return null;
      }
    };

    const tryCdp = async (): Promise<{
      browser: Browser;
      how: string;
      viaCdp: boolean;
    } | null> => {
      try {
        const r = await this.connectCdp(endpoint);
        return { ...r, viaCdp: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(
          `cdp ${endpoint}: ${msg.replace(/\s+/g, " ").slice(0, 200)}`
        );
        return null;
      }
    };

    if (mode === "cdp") {
      const cdp = await tryCdp();
      if (cdp) return cdp;
      throw this.unifiedBrowserError(errors, endpoint, "cdp");
    }

    if (mode === "launch") {
      const launched = await tryLaunch();
      if (launched) return launched;
      throw this.unifiedBrowserError(errors, endpoint, "launch");
    }

    // auto: local UI host (Windows/macOS/Linux desktop) — even when remoteName is set
    // because the workspace is Remote SSH. Launch Chrome on THIS machine first.
    if (!cdpFirst) {
      const launched = await tryLaunch();
      if (launched) return launched;
    }

    const cdp = await tryCdp();
    if (cdp) return cdp;

    // Last resort on mis-hosted remote workspace (usually fails without DISPLAY)
    if (cdpFirst) {
      const launched = await tryLaunch();
      if (launched) return launched;
    }

    throw this.unifiedBrowserError(errors, endpoint, cdpFirst ? "cdp" : "launch");
  }

  private unifiedBrowserError(
    errors: string[],
    endpoint: string,
    kind: "cdp" | "launch"
  ): Error {
    const misHosted = isRemoteLinuxWorkspaceHost();
    // First line is all the user sees in the toast — carry the key insight there.
    const firstLine = misHosted
      ? `Could not open a browser — DaVinchi is running on the REMOTE host; install the VSIX locally (badge must show “ui”).\n`
      : `Could not open a browser.\n`;
    const hostNote = misHosted
      ? `Remote SSH mis-host: extension is running on the Linux server (workspace), not on your PC.\n` +
        `Fix A (recommended): install element-picker-*.vsix on the LOCAL Cursor/VS Code (UI host), then Reload Window.\n` +
        `Badge must show: v… · ui · win32  (not workspace · linux).\n` +
        `Fix B (advanced CDP): run “DaVinchi: Start Local Chrome (CDP)” on your PC, reconnect with\n` +
        `  ssh -R 9222:127.0.0.1:9222 <host>   (or RemoteForward 9222 localhost:9222 in ~/.ssh/config),\n` +
        `then Open browser again.\n\n`
      : this.isRemoteHost()
        ? `Remote workspace open (${vscode.env.remoteName}); browser still launches on the local UI host.\n` +
          `If Chrome did not start, set elementPicker.browserPath to your local chrome.exe.\n\n`
        : "";
    const found = discoverBrowserExecutables({ includePlaywright: false })
      .map((d) => d.executablePath)
      .join("\n  ");
    return Object.assign(
      new Error(
        firstLine +
          hostNote +
          `Platform: ${process.platform} ${os.arch()}\n` +
          `Browsers found here:\n  ${found || "(none)"}\n\n` +
          `Fix:\n` +
          `1) Install Google Chrome or Edge on this PC (the UI machine)\n` +
          `2) Settings → elementPicker.browserPath = full path to chrome.exe\n` +
          `3) Advanced only: browserMode=cdp + local Chrome --remote-debugging-port=9222\n\n` +
          `Attempts:\n  ${errors.slice(0, 8).join("\n  ") || "(none)"}\n` +
          `(CDP endpoint tried: ${endpoint})`
      ),
      { davinchiErrorKind: kind }
    );
  }

  async open(url: string): Promise<void> {
    // Always remember the latest URL. Each chained turn opens whatever is
    // pending when it starts (so concurrent open() never drops the last request).
    this.pendingOpenUrl = url;
    const run = this.openChain.then(async () => {
      const target = this.pendingOpenUrl;
      if (!target) {
        return;
      }
      this.pendingOpenUrl = null;
      await this.openInternal(target);
    });
    // Keep the chain alive even if one open fails so later URLs still run.
    this.openChain = run.catch(() => {
      /* swallowed; callers still see the rejection via `run` */
    });
    return run;
  }

  /** Re-apply host mode flags onto the live page after navigation / reinstall. */
  private async reapplyActiveModes(): Promise<void> {
    if (this.cloneMode) {
      await this.applyCloneMode(true);
    } else if (this.selectMode) {
      await this.applySelectMode(true);
    }
  }

  private async openInternal(url: string): Promise<void> {
    if (this.isOpen && this.page) {
      await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await this.installPicker(this.page);
      await this.reapplyActiveModes();
      return;
    }

    await this.close();

    const { browser, how, viaCdp } = await this.obtainBrowser();
    this.browser = browser;
    this.viaCdp = viaCdp;
    console.log(`[DaVinchi] browser attached via ${how}`);

    if (viaCdp) {
      // Reuse existing Chrome window/tabs — do not create an isolated context
      const contexts = browser.contexts();
      this.context = contexts[0] ?? (await browser.newContext({ viewport: null }));
      const pages = this.context.pages();
      this.page = pages[0] ?? (await this.context.newPage());
    } else {
      this.context = await this.browser.newContext({
        viewport: null,
      });
      this.page = await this.context.newPage();

      try {
        const cdp = await this.context.newCDPSession(this.page);
        const { windowId } = (await cdp.send("Browser.getWindowForTarget")) as {
          windowId: number;
        };
        await cdp.send("Browser.setWindowBounds", {
          windowId,
          bounds: { windowState: "maximized" },
        });
      } catch {
        /* maximize best-effort */
      }
    }

    // Capture current objects — events from a stale page/browser (closed or
    // orphaned by a later open) must not wipe the live session's state.
    const openedPage = this.page;
    openedPage.on("close", () => {
      if (this.page !== openedPage) return;
      this.selectMode = false;
      this.cloneMode = false;
      this.page = null;
      this.onModeChange?.(false);
      this.onCloneModeChange?.(false);
    });

    browser.on("disconnected", () => {
      if (this.browser !== browser) return;
      this.browser = null;
      this.context = null;
      this.page = null;
      this.selectMode = false;
      this.cloneMode = false;
      this.viaCdp = false;
      this.onModeChange?.(false);
      this.onCloneModeChange?.(false);
    });

    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await this.installPicker(this.page);

    if (viaCdp) {
      void vscode.window.showInformationMessage(
        t("msgCdpConnected", how)
      );
    }
  }

  private async installPicker(page: Page): Promise<void> {
    // exposeFunction is once per BrowserContext page binding lifetime
    if (!this.exposed) {
      try {
        await page.exposeFunction(
          "__elementPickerOnPick",
          async (payload: ElementPickPayload) => {
            if (this.onPick && this.page) {
              await this.onPick(payload, this.page);
            }
          }
        );
        await page.exposeFunction("__elementPickerOnModeChange", (on: boolean) => {
          this.selectMode = !!on;
          if (this.selectMode) this.cloneMode = false;
          this.onModeChange?.(this.selectMode);
          this.onCloneModeChange?.(this.cloneMode);
        });
        await page.exposeFunction(
          "__elementPickerOnCloneModeChange",
          (on: boolean) => {
            this.cloneMode = !!on;
            if (this.cloneMode) this.selectMode = false;
            this.onCloneModeChange?.(this.cloneMode);
            this.onModeChange?.(this.selectMode);
          }
        );
        this.exposed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/already registered/i.test(msg)) {
          throw e;
        }
        // already exposed in this context
        this.exposed = true;
      }
    }

    await page.evaluate(getPickerBootstrapSource());

    // Re-install after navigations (hook once per page instance)
    if (!this.navHooked) {
      this.navHooked = true;
      page.on("framenavigated", async (frame) => {
        if (frame !== page.mainFrame()) return;
        try {
          await page.evaluate(getPickerBootstrapSource());
          if (this.cloneMode) {
            await page.evaluate(
              getSetCloneOptionsSource({ fullSite: getCloneOptions().fullSite })
            );
            await page.evaluate(getSetCloneModeSource(true));
          } else if (this.selectMode) {
            await page.evaluate(getSetModeSource(true));
          }
        } catch {
          // page may be mid-navigation
        }
      });
    }
  }

  private async applySelectMode(on: boolean): Promise<boolean> {
    if (!this.page || this.page.isClosed()) {
      this.selectMode = false;
      return false;
    }
    const result = await this.page.evaluate(getSetModeSource(on));
    // evaluate returns the new mode from page
    if (typeof result === "boolean") {
      this.selectMode = result;
    } else {
      this.selectMode = on;
    }
    if (this.selectMode) this.cloneMode = false;
    return this.selectMode;
  }

  private async applyCloneMode(on: boolean): Promise<boolean> {
    if (!this.page || this.page.isClosed()) {
      this.cloneMode = false;
      return false;
    }
    try {
      await this.page.evaluate(
        getSetCloneOptionsSource({ fullSite: getCloneOptions().fullSite })
      );
    } catch {
      /* options push is best-effort */
    }
    const result = await this.page.evaluate(getSetCloneModeSource(on));
    if (typeof result === "boolean") {
      this.cloneMode = result;
    } else {
      this.cloneMode = on;
    }
    if (this.cloneMode) this.selectMode = false;
    return this.cloneMode;
  }

  async setSelectMode(on: boolean): Promise<boolean> {
    if (!this.isOpen) {
      throw new Error("Browser is not open. Open a URL first.");
    }
    // Ensure picker script is present
    await this.page!.evaluate(getPickerBootstrapSource());
    if (on && this.cloneMode) {
      await this.applyCloneMode(false);
      this.onCloneModeChange?.(false);
    }
    const mode = await this.applySelectMode(on);
    this.onModeChange?.(mode);
    return mode;
  }

  async setCloneMode(on: boolean): Promise<boolean> {
    if (!this.isOpen) {
      throw new Error("Browser is not open. Open a URL first.");
    }
    await this.page!.evaluate(getPickerBootstrapSource());
    if (on && this.selectMode) {
      await this.applySelectMode(false);
      this.onModeChange?.(false);
    }
    const mode = await this.applyCloneMode(on);
    this.onCloneModeChange?.(mode);
    return mode;
  }

  async toggleSelectMode(): Promise<boolean> {
    return this.setSelectMode(!this.selectMode);
  }

  /** Re-push clone options (e.g. full-site toggle) into the live page. */
  async applyCloneOptions(): Promise<void> {
    if (!this.isOpen || !this.page) return;
    try {
      await this.page.evaluate(
        getSetCloneOptionsSource({ fullSite: getCloneOptions().fullSite })
      );
    } catch {
      /* page busy or navigating */
    }
  }

  async toggleCloneMode(): Promise<boolean> {
    return this.setCloneMode(!this.cloneMode);
  }

  /**
   * Download a URL using the browser context (cookies / CORS as the page).
   * Optional maxBytes skips oversized responses (Content-Length and body size).
   */
  async downloadUrl(
    url: string,
    opts?: { maxBytes?: number }
  ): Promise<{ bytes: Uint8Array; contentType?: string } | null> {
    if (!this.context) return null;
    const maxBytes = opts?.maxBytes ?? 8 * 1024 * 1024;
    try {
      const res = await this.context.request.get(url, { timeout: 15000 });
      if (!res.ok()) return null;
      const cl = Number(res.headers()["content-length"] || 0);
      if (cl > 0 && cl > maxBytes) return null;
      const body = await res.body();
      if (body.byteLength > maxBytes) return null;
      const contentType = res.headers()["content-type"];
      return { bytes: new Uint8Array(body), contentType };
    } catch {
      // Fallback: fetch inside page (must time out — silent servers hang forever)
      if (!this.page || this.page.isClosed()) return null;
      try {
        const result = await Promise.race([
          this.page.evaluate(
            async (args: { u: string; maxBytes: number }) => {
              try {
                const ctrl =
                  typeof AbortController !== "undefined"
                    ? new AbortController()
                    : null;
                const timer = ctrl
                  ? setTimeout(() => ctrl.abort(), 12000)
                  : null;
                const r = await fetch(args.u, {
                  credentials: "include",
                  mode: "cors",
                  signal: ctrl ? ctrl.signal : undefined,
                });
                if (timer) clearTimeout(timer);
                if (!r.ok) return null;
                const cl = Number(r.headers.get("content-length") || 0);
                if (cl > 0 && cl > args.maxBytes) return null;
                const ct = r.headers.get("content-type") || undefined;
                const buf = await r.arrayBuffer();
                if (buf.byteLength > args.maxBytes) return null;
                const bytes = Array.from(new Uint8Array(buf));
                return { bytes, contentType: ct };
              } catch {
                return null;
              }
            },
            { u: url, maxBytes }
          ),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000)),
        ]);
        if (!result?.bytes?.length) return null;
        if (result.bytes.length > maxBytes) return null;
        return {
          bytes: new Uint8Array(result.bytes),
          contentType: result.contentType,
        };
      } catch {
        return null;
      }
    }
  }

  /**
   * Multi-shot capture for clone packs: element + full page + parent area.
   * page.png / parent.png follow the user's clone options (may be skipped).
   */
  async screenshotClonePack(payload: ElementPickPayload): Promise<{
    elementPng: Uint8Array;
    pagePng: Uint8Array | null;
    parentPng: Uint8Array | null;
  }> {
    if (!this.page || this.page.isClosed()) {
      throw new Error("Browser page is closed.");
    }
    const opts = getCloneOptions();

    try {
      await this.page.evaluate(getPickerBootstrapSource());
      await this.page.evaluate(getHideForCaptureSource());
      await new Promise((r) => setTimeout(r, 40));
    } catch {
      /* best-effort */
    }

    try {
      const elementPng = await this.captureElementPng(payload);

      let pagePng: Uint8Array | null = null;
      if (opts.pageScreenshot) {
        try {
          const buf = await this.page.screenshot({
            type: "png",
            fullPage: true,
          });
          pagePng = new Uint8Array(buf);
        } catch {
          const buf = await this.page.screenshot({ type: "png" });
          pagePng = new Uint8Array(buf);
        }
      }

      let parentPng: Uint8Array | null = null;
      const parentBox = (
        payload as ElementPickPayload & {
          parentDimensions?: {
            top: number;
            left: number;
            width: number;
            height: number;
          } | null;
        }
      ).parentDimensions;
      if (
        opts.parentScreenshot &&
        parentBox &&
        parentBox.width > 2 &&
        parentBox.height > 2
      ) {
        try {
          const buf = await this.page.screenshot({
            type: "png",
            clip: {
              x: Math.max(0, parentBox.left),
              y: Math.max(0, parentBox.top),
              width: Math.max(1, Math.round(parentBox.width)),
              height: Math.max(1, Math.round(parentBox.height)),
            },
          });
          parentPng = new Uint8Array(buf);
        } catch {
          parentPng = null;
        }
      }

      return { elementPng, pagePng, parentPng };
    } finally {
      try {
        await this.page.evaluate(getRestoreAfterCaptureSource());
      } catch {
        /* page may have closed */
      }
    }
  }

  private async captureElementPng(
    payload: ElementPickPayload
  ): Promise<Uint8Array> {
    if (!this.page || this.page.isClosed()) {
      throw new Error("Browser page is closed.");
    }
    const { left, top, width, height } = payload.dimensions;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    // Sliders/carousels can move or collapse the element between pick and
    // capture; a re-measured box then crops the wrong area (e.g. 1703×62
    // instead of 1703×700 for an rs-slide). Only trust a live locator when
    // its current box still matches the box saved at pick time.
    const boxMatches = (
      box: { width: number; height: number } | null
    ): boolean =>
      !!box &&
      Math.abs(box.width - w) <= Math.max(4, w * 0.05) &&
      Math.abs(box.height - h) <= Math.max(4, h * 0.05);

    // Prefer the exact element marked by the picker at click time — short
    // selectors like "div.card" are often ambiguous and hit a wrong element.
    // pickToken is a per-capture nonce so a second click cannot steal the mark.
    try {
      const rawToken = (payload as { pickToken?: string }).pickToken;
      const token =
        typeof rawToken === "string"
          ? rawToken.replace(/[^a-zA-Z0-9_-]/g, "")
          : "";
      const markSel = token
        ? `[data-davinchi-picked="${token}"]`
        : "[data-davinchi-picked]";
      const marked = this.page.locator(markSel);
      if (
        (await marked.count()) === 1 &&
        boxMatches(await marked.boundingBox())
      ) {
        const buf = await marked.screenshot({ type: "png", timeout: 10000 });
        return new Uint8Array(buf);
      }
    } catch {
      // fall through to selector / clip fallbacks
    }

    const sel = payload.selector;
    if (sel && !sel.includes(" > ")) {
      try {
        const loc = this.page.locator(sel).first();
        const count = await this.page.locator(sel).count();
        if (count >= 1 && boxMatches(await loc.boundingBox())) {
          const buf = await loc.screenshot({ type: "png" });
          return new Uint8Array(buf);
        }
      } catch {
        // fall through
      }
    }

    try {
      const buf = await this.page.screenshot({
        type: "png",
        clip: {
          x: Math.max(0, left),
          y: Math.max(0, top),
          width: w,
          height: h,
        },
      });
      return new Uint8Array(buf);
    } catch {
      const buf = await this.page.screenshot({ type: "png" });
      return new Uint8Array(buf);
    }
  }

  /**
   * Capture PNG bytes of the element at the given viewport box.
   * Hides cyan highlight overlay first so it never appears on the image.
   */
  async screenshotElement(payload: ElementPickPayload): Promise<Uint8Array> {
    if (!this.page || this.page.isClosed()) {
      throw new Error("Browser page is closed.");
    }

    // Ensure picker APIs exist, then hide overlay before capture
    try {
      await this.page.evaluate(getPickerBootstrapSource());
      await this.page.evaluate(getHideForCaptureSource());
      // Yield so the browser paints without the cyan outline
      await new Promise((r) => setTimeout(r, 40));
    } catch {
      /* best-effort */
    }

    try {
      return await this.captureElementPng(payload);
    } finally {
      // Restore cyan outline for continued picking
      try {
        await this.page.evaluate(getRestoreAfterCaptureSource());
      } catch {
        /* page may have closed */
      }
    }
  }

  async close(): Promise<void> {
    this.selectMode = false;
    this.cloneMode = false;
    this.navHooked = false;
    this.exposed = false;
    const viaCdp = this.viaCdp;
    this.viaCdp = false;

    if (viaCdp) {
      // Leave the user's local Chrome running — for connectOverCDP, close()
      // only drops our connection and does NOT kill the user's browser.
      try {
        await this.browser?.close();
      } catch {
        /* ignore */
      }
      this.page = null;
      this.context = null;
      this.browser = null;
      return;
    }

    try {
      await this.context?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
