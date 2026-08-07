import type { ElementClonePayload, SavedCloneAsset } from "../types";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
    "base64"
  );
}

function mimeFromName(name: string, contentType?: string): string {
  if (contentType && contentType.includes("/")) {
    return contentType.split(";")[0].trim();
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".css")) return "text/css";
  return "application/octet-stream";
}

function dataUrl(
  bytes: Uint8Array,
  mime: string
): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/**
 * Rewrite url(...) references that point at downloaded assets to data: URLs.
 */
function inlineAssetUrlsInCss(
  css: string,
  assets: SavedCloneAsset[],
  assetBytes: Map<string, Uint8Array>
): string {
  let out = css;
  for (const a of assets) {
    if (!a.ok || !a.localRel) continue;
    const bytes = assetBytes.get(a.localRel);
    if (!bytes) continue;
    const mime = mimeFromName(a.localRel, a.contentType);
    const du = dataUrl(bytes, mime);
    const originals = [a.originalUrl, a.localRel, `./${a.localRel}`, a.localRel.replace(/^assets\//, "")];
    for (const orig of originals) {
      if (!orig || orig.startsWith("data:")) continue;
      // Replace url("…") / url('…') / url(…)
      const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `url\\(\\s*(['"]?)${escaped}\\1\\s*\\)`,
        "gi"
      );
      out = out.replace(re, `url("${du}")`);
    }
  }
  return out;
}

export interface StandalonePreviewInput {
  payload: ElementClonePayload;
  stylesCss: string;
  subtreeHtml: string;
  elementPng: Uint8Array;
  pagePng?: Uint8Array | null;
  parentPng?: Uint8Array | null;
  assets: SavedCloneAsset[];
  /** Map localRel → file bytes for inlining. */
  assetBytes: Map<string, Uint8Array>;
}

/**
 * Self-contained preview.html — open in any browser, no server needed.
 * Shows reference screenshots + live render of captured subtree + CSS.
 */
export function buildStandalonePreviewHtml(input: StandalonePreviewInput): string {
  const { payload, stylesCss, subtreeHtml } = input;
  const d = payload.dimensions;
  const elementData = dataUrl(input.elementPng, "image/png");
  const pageData =
    input.pagePng && input.pagePng.byteLength > 0
      ? dataUrl(input.pagePng, "image/png")
      : "";
  const parentData =
    input.parentPng && input.parentPng.byteLength > 0
      ? dataUrl(input.parentPng, "image/png")
      : "";

  const inlinedCss = inlineAssetUrlsInCss(
    stylesCss,
    input.assets,
    input.assetBytes
  );

  // Also inject @font-face for downloaded font files that may not appear in CSS urls
  const fontFaces: string[] = [];
  for (const a of input.assets) {
    if (!a.ok || a.kind !== "font" || !a.localRel) continue;
    const bytes = input.assetBytes.get(a.localRel);
    if (!bytes) continue;
    const mime = mimeFromName(a.localRel, a.contentType);
    const du = dataUrl(bytes, mime);
    fontFaces.push(
      `@font-face { font-family: "clone-asset-${a.localRel.replace(/[^a-zA-Z0-9_-]/g, "_")}"; src: url("${du}"); font-display: swap; }`
    );
  }

  const liveCss = [
    "/* DaVinchi standalone preview — inlined clone styles */",
    fontFaces.join("\n"),
    inlinedCss,
    "",
    "/* Preview chrome isolation */",
    ".dv-live-root, .dv-live-root * { box-sizing: border-box; }",
  ].join("\n");

  // Escape for embedding in <script type="text/plain"> / template — use base64 for HTML/CSS blobs
  const cssB64 = Buffer.from(liveCss, "utf8").toString("base64");
  const htmlB64 = Buffer.from(subtreeHtml || "", "utf8").toString("base64");

  const title = `Clone preview: ${payload.selector || payload.tagName}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root {
    color-scheme: dark light;
    --bg: #0b0e14;
    --panel: #12171f;
    --border: #243044;
    --text: #e6edf3;
    --muted: #8b9bb4;
    --accent: #ce93d8;
    --cyan: #4fc3f7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.45;
  }
  header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, #151b26, var(--bg));
  }
  header h1 {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 650;
    letter-spacing: 0.02em;
  }
  header .meta {
    color: var(--muted);
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
  }
  header .badge {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 10px;
    background: #3b1f4a;
    color: var(--accent);
    border: 1px solid #6b3d7a;
    vertical-align: middle;
  }
  main {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 16px;
    max-width: 1400px;
    margin: 0 auto;
  }
  @media (min-width: 1100px) {
    main { grid-template-columns: 1fr 1fr; }
  }
  section {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  section h2 {
    margin: 0;
    padding: 10px 14px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: #0e131b;
  }
  .body { padding: 12px; }
  .shot {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: #000;
  }
  .shots { display: grid; gap: 12px; }
  .label {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .live-wrap {
    overflow: auto;
    max-height: min(80vh, 900px);
    border: 1px dashed #3d4f6a;
    border-radius: 8px;
    background: #fff;
    color: #111;
    padding: 12px;
    min-height: ${Math.max(80, Math.min(d.height || 200, 480))}px;
  }
  .note {
    font-size: 12px;
    color: var(--muted);
    padding: 0 14px 14px;
  }
  .note code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--cyan);
  }
  footer {
    padding: 12px 20px 24px;
    color: var(--muted);
    font-size: 11px;
    text-align: center;
  }
</style>
</head>
<body>
<header>
  <h1>
    DaVinchi clone preview
    <span class="badge">standalone</span>
  </h1>
  <div class="meta">
    ${esc(payload.selector || payload.tagName)}
    · ${d.width}×${d.height}px
    · DPR ${payload.devicePixelRatio ?? 1}
    <br/>
    ${esc(payload.url)}
    <br/>
    ${esc(payload.title || "")}
    · captured ${esc(new Date().toISOString())}
  </div>
</header>
<main>
  <section>
    <h2>Reference screenshots</h2>
    <div class="body shots">
      <div>
        <div class="label">element.png</div>
        <img class="shot" alt="element" src="${elementData}" />
      </div>
      ${
        parentData
          ? `<div>
        <div class="label">parent.png</div>
        <img class="shot" alt="parent" src="${parentData}" />
      </div>`
          : ""
      }
      ${
        pageData
          ? `<div>
        <div class="label">page.png (full page)</div>
        <img class="shot" alt="page" src="${pageData}" />
      </div>`
          : ""
      }
    </div>
    <p class="note">Use these as the visual ground truth when rebuilding the UI.</p>
  </section>

  <section>
    <h2>Live render (subtree + CSS)</h2>
    <div class="body">
      <div class="label">Captured outerHTML with matched styles (best-effort)</div>
      <div class="live-wrap" id="live"></div>
    </div>
    <p class="note">
      Live render is approximate: absolute layouts, cross-origin fonts, canvas engines,
      and JS behaviour may not match 1:1. Prefer screenshots + <code>CLONE.md</code> for fidelity.
    </p>
  </section>
</main>
<footer>Generated by DaVinchi Element Picker · self-contained file (no network required for inlined assets)</footer>
<script>
(function () {
  function b64ToUtf8(b64) {
    try {
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      try { return decodeURIComponent(escape(atob(b64))); } catch (_) { return ''; }
    }
  }
  function sanitize(rootEl) {
    // Captured markup is untrusted: strip anything that could execute script
    var bad = rootEl.querySelectorAll('script, iframe, object, embed');
    for (var i = 0; i < bad.length; i++) {
      if (bad[i].parentNode) bad[i].parentNode.removeChild(bad[i]);
    }
    var all = rootEl.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      for (var j = el.attributes.length - 1; j >= 0; j--) {
        var attr = el.attributes[j];
        var an = attr.name.toLowerCase();
        if (an.indexOf('on') === 0) {
          el.removeAttribute(attr.name);
        } else if (an === 'href' || an === 'src' || an === 'xlink:href') {
          var v = attr.value.replace(/\\s+/g, '').toLowerCase();
          if (v.indexOf('javascript:') === 0) el.removeAttribute(attr.name);
        }
      }
    }
  }
  var css = b64ToUtf8(${JSON.stringify(cssB64)});
  var html = b64ToUtf8(${JSON.stringify(htmlB64)});
  var host = document.getElementById('live');
  if (!host) return;
  // Shadow DOM keeps cloned page CSS from leaking into the preview chrome
  var shadow = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = css;
  shadow.appendChild(style);
  var wrap = document.createElement('div');
  wrap.className = 'dv-live-root';
  wrap.innerHTML = html;
  sanitize(wrap);
  shadow.appendChild(wrap);
})();
</script>
</body>
</html>
`;
}
