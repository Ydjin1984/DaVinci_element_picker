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
import { t } from "../i18n";
import type { BrowserChannel, ElementPickPayload } from "../types";
import {
  getHideForCaptureSource,
  getPickerBootstrapSource,
  getRestoreAfterCaptureSource,
  getSetCloneModeSource,
  getSetModeSource,
} from "./pickerInject";

export type PickHandler = (payload: ElementPickPayload, page: Page) => void | Promise<void>;
export type ModeHandler = (on: boolean) => void;

/** Best discovered system Chrome/Edge path, or "". */
export function findPreferredBrowserPath(): string {
  const list = discoverBrowserExecutables();
  const chrome = list.find((x) => x.label === "chrome");
  if (chrome) return chrome.executablePath;
  return list[0]?.executablePath || "";
}

/**
 * If browserPath is empty and we found Chrome/Edge on disk, save it to User settings
 * so launch always uses a real executable (avoids empty Playwright cache).
 */
export async function ensureBrowserPathSetting(): Promise<string> {
  const cfg = vscode.workspace.getConfiguration("elementPicker");
  const current = (cfg.get<string>("browserPath", "") || "").trim();
  if (current && fs.existsSync(current)) {
    return current;
  }
  const found = findPreferredBrowserPath();
  if (!found) {
    return "";
  }
  try {
    await cfg.update("browserPath", found, vscode.ConfigurationTarget.Global);
  } catch {
    /* read-only / restricted */
  }
  return found;
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

/** Common install locations for system Chrome / Edge (Windows user-local, Linux remote, macOS). */
function discoverBrowserExecutables(): Array<{ label: string; executablePath: string }> {
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
    // Linux (remote SSH / servers often only have these)
    { label: "chrome", executablePath: "/usr/bin/google-chrome-stable" },
    { label: "chrome", executablePath: "/usr/bin/google-chrome" },
    { label: "chrome", executablePath: "/usr/bin/chromium-browser" },
    { label: "chrome", executablePath: "/usr/bin/chromium" },
    { label: "chrome", executablePath: "/snap/bin/chromium" },
    { label: "chrome", executablePath: "/usr/bin/chrome" },
    { label: "msedge", executablePath: "/usr/bin/microsoft-edge" },
    { label: "msedge", executablePath: "/usr/bin/microsoft-edge-stable" },
    // Chrome-for-Testing / playwright cache if already installed
    {
      label: "chrome",
      executablePath: path.join(
        home,
        ".cache",
        "ms-playwright",
        "chromium-1234",
        "chrome-linux64",
        "chrome"
      ),
    },
  ];

  for (const c of candidates) {
    pushIfExists(out, seen, c.label, c.executablePath);
  }

  // Scan playwright cache for any chrome binary (linux/mac/win)
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
  /** In-flight open() — a second call reuses it instead of opening twice. */
  private openInFlight: Promise<void> | null = null;

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
    return (
      vscode.workspace
        .getConfiguration("elementPicker")
        .get<string>("browserPath", "") || ""
    ).trim();
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
   */
  static localChromeDebugCommand(url: string, port = 9222): string {
    const safeUrl = url.replace(/"/g, "").replace(/'/g, "");
    return [
      `# DaVinchi — run this on your WINDOWS PC (local Chrome for remote SSH picks)`,
      `$port = ${port}`,
      `$url = '${safeUrl}'`,
      `$chrome = Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe'`,
      `if (-not (Test-Path $chrome)) { $chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }`,
      `if (-not (Test-Path $chrome)) { $chrome = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' }`,
      `if (-not (Test-Path $chrome)) { throw 'Chrome/Edge not found. Install Google Chrome.' }`,
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
    if (custom) {
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

    // Paths FIRST — channel often falls into empty ms-playwright cache on Linux/remote
    const discovered = discoverBrowserExecutables().sort((a, b) => {
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

    // Bundled Playwright Chromium — only if already on disk (skip download trap)
    const home = os.homedir();
    const pwRoot = playwrightCacheRoot();
    let hasPwChrome = false;
    try {
      if (fs.existsSync(pwRoot)) {
        for (const name of fs.readdirSync(pwRoot)) {
          if (!name.startsWith("chromium")) continue;
          const p = path.join(pwRoot, name, "chrome-linux64", "chrome");
          if (fs.existsSync(p)) {
            hasPwChrome = true;
            break;
          }
          const pWin = path.join(pwRoot, name, "chrome-win64", "chrome.exe");
          if (fs.existsSync(pWin)) {
            hasPwChrome = true;
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }
    if (hasPwChrome || channel === "chromium") {
      attempts.push({
        how: "playwright-chromium",
        opts: { headless: false, args: launchArgs },
      });
    }

    const errors: string[] = [];
    for (const attempt of attempts) {
      try {
        const browser = await chromium.launch(attempt.opts);
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
    const platform = `${process.platform} ${os.arch()} home=${home}`;

    throw new Error(
      `Could not launch a browser on the extension host.\n` +
        remote +
        `Platform: ${platform}\n` +
        `Found browsers:\n  ${found}\n\n` +
        `Recommended (Remote SSH): use LOCAL Chrome via CDP — command\n` +
        `  “DaVinchi: Start Local Chrome (CDP)”\n` +
        `then Open browser again (browserMode=auto|cdp).\n\n` +
        `Attempts:\n  ${errors.slice(0, 8).join("\n  ")}`
    );
  }

  /** True if a system Chrome/Edge binary is available on THIS machine (extension host). */
  private canLaunchSystemBrowserHere(): boolean {
    const custom = this.configuredBrowserPath();
    if (custom && fs.existsSync(custom)) return true;
    return discoverBrowserExecutables().length > 0;
  }

  /**
   * Obtain a browser — same path for local and Remote SSH when extensionKind includes "ui"
   * (extension host runs on your PC; workspace files still write to remote folder).
   *
   * auto: launch system Chrome if present → else CDP
   * launch: only launch
   * cdp: only CDP
   */
  private async obtainBrowser(): Promise<{
    browser: Browser;
    how: string;
    viaCdp: boolean;
  }> {
    const mode = this.browserMode();
    const endpoint = this.cdpEndpoint();
    const canLaunch = this.canLaunchSystemBrowserHere();
    const errors: string[] = [];

    const tryLaunch = async (): Promise<{ browser: Browser; how: string; viaCdp: boolean } | null> => {
      try {
        const r = await this.launchLocalBrowser();
        return { ...r, viaCdp: false };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`launch: ${msg.replace(/\s+/g, " ").slice(0, 240)}`);
        return null;
      }
    };

    const tryCdp = async (): Promise<{ browser: Browser; how: string; viaCdp: boolean } | null> => {
      try {
        const r = await this.connectCdp(endpoint);
        return { ...r, viaCdp: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`cdp ${endpoint}: ${msg.replace(/\s+/g, " ").slice(0, 200)}`);
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

    // auto: launch first when Chrome exists on this host (local PC / UI extension host)
    if (canLaunch) {
      const launched = await tryLaunch();
      if (launched) return launched;
    }

    const cdp = await tryCdp();
    if (cdp) return cdp;

    // Last resort: try launch even if discovery missed the binary
    if (!canLaunch) {
      const launched = await tryLaunch();
      if (launched) return launched;
    }

    // auto mode: CDP is the real target only on a remote host without a local browser
    throw this.unifiedBrowserError(
      errors,
      endpoint,
      this.isRemoteHost() && !canLaunch ? "cdp" : "launch"
    );
  }

  private unifiedBrowserError(
    errors: string[],
    endpoint: string,
    kind: "cdp" | "launch"
  ): Error {
    const hostNote = this.isRemoteHost()
      ? `Workspace is Remote SSH (${vscode.env.remoteName}), but DaVinchi prefers the local UI host so Chrome opens on your PC.\n` +
        `If this still fails, ensure the extension is not forced to “workspace” only, and Chrome is installed locally.\n\n`
      : "";
    const found = discoverBrowserExecutables()
      .map((d) => d.executablePath)
      .join("\n  ");
    return Object.assign(
      new Error(
        `Could not open a browser.\n` +
          hostNote +
          `Platform: ${process.platform} ${os.arch()}\n` +
          `Browsers found here:\n  ${found || "(none)"}\n\n` +
          `Fix:\n` +
          `1) Install Google Chrome or Edge on this PC\n` +
          `2) Settings → elementPicker.browserPath = full path to chrome.exe\n` +
          `3) Optional advanced: start Chrome with --remote-debugging-port=9222 and set browserMode=cdp\n\n` +
          `Attempts:\n  ${errors.slice(0, 8).join("\n  ") || "(none)"}\n` +
          `(CDP endpoint tried: ${endpoint})`
      ),
      { davinchiErrorKind: kind }
    );
  }

  async open(url: string): Promise<void> {
    if (this.openInFlight) {
      return this.openInFlight;
    }
    const inFlight = this.openInternal(url).finally(() => {
      this.openInFlight = null;
    });
    this.openInFlight = inFlight;
    return inFlight;
  }

  private async openInternal(url: string): Promise<void> {
    if (this.isOpen && this.page) {
      await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await this.installPicker(this.page);
      if (this.selectMode) {
        await this.applySelectMode(true);
      }
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

  async toggleCloneMode(): Promise<boolean> {
    return this.setCloneMode(!this.cloneMode);
  }

  /**
   * Download a URL using the browser context (cookies / CORS as the page).
   */
  async downloadUrl(
    url: string
  ): Promise<{ bytes: Uint8Array; contentType?: string } | null> {
    if (!this.context) return null;
    try {
      const res = await this.context.request.get(url, { timeout: 20000 });
      if (!res.ok()) return null;
      const body = await res.body();
      const contentType = res.headers()["content-type"];
      return { bytes: new Uint8Array(body), contentType };
    } catch {
      // Fallback: fetch inside page
      if (!this.page || this.page.isClosed()) return null;
      try {
        const result = await this.page.evaluate(async (u: string) => {
          try {
            const r = await fetch(u, { credentials: "include", mode: "cors" });
            if (!r.ok) return null;
            const ct = r.headers.get("content-type") || undefined;
            const buf = await r.arrayBuffer();
            const bytes = Array.from(new Uint8Array(buf));
            return { bytes, contentType: ct };
          } catch {
            return null;
          }
        }, url);
        if (!result?.bytes?.length) return null;
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
   */
  async screenshotClonePack(payload: ElementPickPayload): Promise<{
    elementPng: Uint8Array;
    pagePng: Uint8Array;
    parentPng: Uint8Array | null;
  }> {
    if (!this.page || this.page.isClosed()) {
      throw new Error("Browser page is closed.");
    }

    try {
      await this.page.evaluate(getPickerBootstrapSource());
      await this.page.evaluate(getHideForCaptureSource());
      await new Promise((r) => setTimeout(r, 40));
    } catch {
      /* best-effort */
    }

    try {
      const elementPng = await this.captureElementPng(payload);

      let pagePng: Uint8Array;
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
      if (parentBox && parentBox.width > 2 && parentBox.height > 2) {
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

    // Prefer the exact element marked by the picker at click time — short
    // selectors like "div.card" are often ambiguous and hit a wrong element.
    try {
      const marked = this.page.locator('[data-davinchi-picked="1"]');
      if ((await marked.count()) === 1) {
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
        if (count >= 1) {
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
