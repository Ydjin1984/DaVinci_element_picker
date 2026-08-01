/** Payload produced by the injected page script on element click. */
export interface ElementPickPayload {
  tagName: string;
  id: string;
  className: string;
  selector: string;
  htmlPath: string;
  outerHTML: string;
  innerText: string;
  url: string;
  title: string;
  dimensions: {
    top: number;
    left: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
  /** Device pixel ratio at capture time (for screenshot crop). */
  devicePixelRatio: number;
  /** Own + matched CSS text (best-effort). */
  cssText: string;
  /** Key computed style properties. */
  resolvedStyles: Record<string, string>;
  /** CSS custom properties used / defined. */
  cssVariables: Record<string, string>;
  /** Inherited styles subset. */
  inheritedStyles: Record<string, string>;
  /**
   * Present when the picked node is a <canvas>.
   * Compares CSS box vs bitmap attributes vs devicePixelRatio (blur debug).
   */
  canvasMetrics?: {
    cssWidth: number;
    cssHeight: number;
    bitmapWidth: number;
    bitmapHeight: number;
    attrWidth: number | null;
    attrHeight: number | null;
    devicePixelRatio: number;
    scaleX: number;
    scaleY: number;
    expectedScale: number;
    status: "ok" | "under-scaled" | "over-scaled" | "unknown";
    note: string;
  } | null;
}

export interface SavedPick {
  folderUri: import("vscode").Uri;
  contextUri: import("vscode").Uri;
  imageUri: import("vscode").Uri;
  contextPath: string;
  imagePath: string;
  selector: string;
  url: string;
  timestamp: string;
}

export type BrowserChannel = "chromium" | "chrome" | "msedge";

/**
 * How to attach to a browser:
 * - auto: remote SSH → CDP (local Chrome); local workspace → launch system Chrome
 * - cdp: always connect to existing Chrome (remote-debugging-port)
 * - launch: always spawn browser on the extension-host machine
 */
export type BrowserMode = "auto" | "cdp" | "launch";
