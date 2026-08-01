import * as vscode from "vscode";
import {
  chromium,
  type Browser,
  type BrowserContext,
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

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private selectMode = false;
  private onPick: PickHandler | null = null;
  private onModeChange: ModeHandler | null = null;
  private navHooked = false;
  private exposed = false;

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

    const channel = this.channel();
    // --start-maximized + viewport:null → page fills the real browser window
    // (fixed viewport like 1400x900 leaves gray empty space around content)
    const launchArgs = [
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
      "--window-position=0,0",
    ];
    try {
      this.browser = await chromium.launch({
        headless: false,
        channel: channel === "chromium" ? undefined : channel,
        args: launchArgs,
      });
    } catch (err) {
      // Fallback: try next channels
      const fallbacks: BrowserChannel[] = ["chrome", "msedge", "chromium"];
      let last = err;
      for (const fb of fallbacks) {
        if (fb === channel) continue;
        try {
          this.browser = await chromium.launch({
            headless: false,
            channel: fb === "chromium" ? undefined : fb,
            args: launchArgs,
          });
          last = null;
          void vscode.window.showInformationMessage(
            t("browserChannelFallback", fb, channel)
          );
          break;
        } catch (e) {
          last = e;
        }
      }
      if (!this.browser) {
        throw new Error(
          `Could not launch a browser (tried ${channel} and fallbacks). Install Chrome or Edge, or set elementPicker.browserChannel. ${String(last)}`
        );
      }
    }

    // viewport: null = page layout follows the real browser window size
    // (not a fixed 1400×900 “device” box inside a larger window)
    this.context = await this.browser.newContext({
      viewport: null,
    });
    this.page = await this.context.newPage();

    // Force maximized window via CDP (more reliable than --start-maximized alone)
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
      this.onModeChange?.(false);
    });

    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await this.installPicker(this.page);
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
