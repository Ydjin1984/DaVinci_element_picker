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
    const pw = path.join(home, ".cache", "ms-playwright");
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
  private onPick: PickHandler | null = null;
  private onModeChange: ModeHandler | null = null;
  private navHooked = false;
  private exposed = false;
  /** Connected to user's existing Chrome via CDP — do not kill Chrome on close. */
  private viaCdp = false;

  get isOpen(): boolean {
    return !!this.page && !this.page.isClosed();
  }

  get isSelectMode(): boolean {
    return this.selectMode;
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
    const pwRoot = path.join(home, ".cache", "ms-playwright");
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

  /**
   * Obtain a browser: prefer CDP (local Chrome) on Remote SSH; else launch.
   */
  private async obtainBrowser(): Promise<{
    browser: Browser;
    how: string;
    viaCdp: boolean;
  }> {
    const mode = this.browserMode();
    const endpoint = this.cdpEndpoint();
    const remote = this.isRemoteHost();
    const preferCdp = mode === "cdp" || (mode === "auto" && remote);

    const cdpErrors: string[] = [];

    // 1) CDP first when remote or mode=cdp
    if (preferCdp) {
      try {
        const r = await this.connectCdp(endpoint);
        return { ...r, viaCdp: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        cdpErrors.push(msg.replace(/\s+/g, " ").slice(0, 200));
        // Never spawn Chrome on a remote Linux host in auto/cdp modes
        if (mode === "cdp" || remote) {
          throw this.cdpHelpError(endpoint, cdpErrors);
        }
      }
    }

    // 2) Launch on extension host (local Windows/Mac/Linux desktop)
    if (mode === "launch" || mode === "auto") {
      try {
        const r = await this.launchLocalBrowser();
        return { ...r, viaCdp: false };
      } catch (launchErr) {
        try {
          const r = await this.connectCdp(endpoint);
          return { ...r, viaCdp: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          cdpErrors.push(msg.replace(/\s+/g, " ").slice(0, 200));
          const launchMsg =
            launchErr instanceof Error ? launchErr.message : String(launchErr);
          throw new Error(
            `${launchMsg}\n\nAlso tried CDP ${endpoint}:\n  ${cdpErrors.join("\n  ")}\n` +
              `Run “DaVinchi: Start Local Chrome (CDP)” on your PC, then retry.`
          );
        }
      }
    }

    throw this.cdpHelpError(endpoint, cdpErrors);
  }

  private cdpHelpError(endpoint: string, cdpErrors: string[]): Error {
    const remote = this.isRemoteHost()
      ? `You are on Remote SSH (${vscode.env.remoteName}). Browser must run on your PC.\n\n`
      : "";
    return new Error(
      remote +
        `Cannot connect to local Chrome via CDP (${endpoint}).\n\n` +
        `Do this on your WINDOWS PC (not the server):\n` +
        `1. Command Palette → “DaVinchi: Start Local Chrome (CDP)”\n` +
        `   (copies & can open a PowerShell that starts Chrome with port 9222)\n` +
        `2. If Remote SSH: reverse-forward port 9222 so the server reaches your PC:\n` +
        `   • VS Code/Cursor Ports: “Forward a Port” reverse 9222 → 9222\n` +
        `   • or SSH config: RemoteForward 9222 localhost:9222\n` +
        `3. DaVinchi → Open browser again (picks still save into the SSH workspace).\n\n` +
        `CDP errors:\n  ${cdpErrors.join("\n  ") || "(connection refused)"}`
    );
  }

  async open(url: string): Promise<void> {
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

    this.page.on("close", () => {
      this.selectMode = false;
      this.page = null;
      this.onModeChange?.(false);
    });

    this.browser.on("disconnected", () => {
      this.browser = null;
      this.context = null;
      this.page = null;
      this.selectMode = false;
      this.viaCdp = false;
      this.onModeChange?.(false);
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
          this.onModeChange?.(this.selectMode);
        });
        this.exposed = true;
      } catch {
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
          if (this.selectMode) {
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
    this.selectMode = !!result && on;
    // evaluate returns the new mode from page
    if (typeof result === "boolean") {
      this.selectMode = result;
    } else {
      this.selectMode = on;
    }
    return this.selectMode;
  }

  async setSelectMode(on: boolean): Promise<boolean> {
    if (!this.isOpen) {
      throw new Error("Browser is not open. Open a URL first.");
    }
    // Ensure picker script is present
    await this.page!.evaluate(getPickerBootstrapSource());
    const mode = await this.applySelectMode(on);
    this.onModeChange?.(mode);
    return mode;
  }

  async toggleSelectMode(): Promise<boolean> {
    return this.setSelectMode(!this.selectMode);
  }

  /**
   * Capture PNG bytes of the element at the given viewport box.
   * Hides cyan highlight overlay first so it never appears on the image.
   */
  async screenshotElement(payload: ElementPickPayload): Promise<Uint8Array> {
    if (!this.page || this.page.isClosed()) {
      throw new Error("Browser page is closed.");
    }

    const { left, top, width, height } = payload.dimensions;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

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
      // Prefer selector-based shot when unique enough
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
          // fall through to clip
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
    this.navHooked = false;
    this.exposed = false;
    const viaCdp = this.viaCdp;
    this.viaCdp = false;

    if (viaCdp) {
      // Leave the user's local Chrome running — only drop our connection.
      this.page = null;
      this.context = null;
      try {
        // disconnect without closing Chrome (Playwright close() would kill it)
        this.browser = null;
      } catch {
        this.browser = null;
      }
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
