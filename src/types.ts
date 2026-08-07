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
  /** select = light pick; clone = full agent pack. */
  captureMode?: "select" | "clone";
  /**
   * Per-pick nonce written to data-davinchi-picked. Screenshots target this
   * exact mark so a second click during capture cannot retarget the crop.
   */
  pickToken?: string;
}

/** Asset discovered during clone capture (page-side). */
export interface CloneAssetRef {
  kind: "img" | "background" | "svg" | "font" | "icon" | "video" | "source" | "other";
  url: string;
  /** Optional context for the agent. */
  note?: string;
  /** CSS selector / short path near the asset. */
  selector?: string;
}

/** One ancestor frame for layout context (flex/grid parents). */
export interface CloneAncestorInfo {
  selector: string;
  tagName: string;
  htmlPath: string;
  resolvedStyles: Record<string, string>;
  matchedCss: string;
  dimensions: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/** Computed styles for a node in the clone subtree. */
export interface CloneStyleNode {
  selector: string;
  htmlPath: string;
  tagName: string;
  resolvedStyles: Record<string, string>;
  matchedCss: string;
  depth: number;
}

/** Font face / family info for clone pack. */
export interface CloneFontInfo {
  family: string;
  weight?: string;
  style?: string;
  stretch?: string;
  source?: string;
  status?: string;
}

/** Extra fields produced when captureMode === "clone". */
export interface ElementCloneExtras {
  captureMode: "clone";
  /** True when the capture targeted the whole document (full-site option). */
  fullSiteCapture?: boolean;
  /** Full subtree HTML (may be large; also written to clone/subtree.html). */
  subtreeHTML: string;
  /** Truncation note if HTML was cut. */
  subtreeTruncated: boolean;
  /** Ancestors (closest parent first) for layout context. */
  ancestors: CloneAncestorInfo[];
  /** Parent box for parent-area screenshot (viewport coords). */
  parentDimensions: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  /** Page scroll/viewport metrics for full-page shot. */
  pageMetrics: {
    scrollWidth: number;
    scrollHeight: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  /** Deep matched CSS across subtree + ancestors. */
  deepCssText: string;
  /** @keyframes rules referenced by subtree. */
  keyframesCss: string;
  /** @font-face rules relevant to page/subtree. */
  fontFaceCss: string;
  /** Animation / transition props on root + notable children. */
  motionStyles: Record<string, string>;
  /** Fonts used in subtree. */
  fonts: CloneFontInfo[];
  /** Asset URLs to download. */
  assets: CloneAssetRef[];
  /** Style tree for key nodes (bounded). */
  styleTree: CloneStyleNode[];
  /** Inline SVG markup snippets (bounded). */
  inlineSvgs: string[];
  /** Canvas data URLs in subtree (may be large; limited). */
  canvasDataUrls: Array<{ selector: string; dataUrl: string; width: number; height: number }>;
  /** Pseudo-elements map for root. */
  pseudoElements: Record<string, Record<string, string> | null>;
  /** CSS variables collected from :root + element + ancestors. */
  deepCssVariables: Record<string, string>;
  /** Head meta / link tags useful for fonts & icons. */
  headLinks: Array<{ rel: string; href: string; as?: string; type?: string }>;
}

export type ElementClonePayload = ElementPickPayload & ElementCloneExtras;

export function isClonePayload(
  payload: ElementPickPayload
): payload is ElementClonePayload {
  return payload.captureMode === "clone";
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
  /** True when this pick is a full clone pack. */
  isClone?: boolean;
  /** Absolute path to clone/ directory. */
  cloneDirPath?: string;
  /** Absolute path to clone/CLONE.md. */
  cloneMdPath?: string;
  /** Absolute path to clone/AGENT.md. */
  agentMdPath?: string;
  /** Full-page screenshot path. */
  pageImagePath?: string;
  /** Parent-area screenshot path. */
  parentImagePath?: string;
  /** Local assets directory path. */
  assetsDirPath?: string;
  /** Self-contained clone/preview.html (when enabled in settings). */
  previewHtmlPath?: string;
  /** Zip archive of the clone pack (when enabled in settings). */
  zipPath?: string;
}

/** Downloaded asset written to disk. */
export interface SavedCloneAsset {
  kind: CloneAssetRef["kind"];
  originalUrl: string;
  localPath: string;
  localRel: string;
  bytes: number;
  contentType?: string;
  ok: boolean;
  error?: string;
  note?: string;
  selector?: string;
}

export type BrowserChannel = "chromium" | "chrome" | "msedge";

/**
 * How to attach to a browser:
 * - auto: remote SSH → CDP (local Chrome); local workspace → launch system Chrome
 * - cdp: always connect to existing Chrome (remote-debugging-port)
 * - launch: always spawn browser on the extension-host machine
 */
export type BrowserMode = "auto" | "cdp" | "launch";
