import type {
  ElementClonePayload,
  SavedCloneAsset,
  SavedPick,
} from "../types";
import { fence } from "./contextBuilder";
import { getOutputDirName } from "../storage/pickStore";

function formatStyleMap(map: Record<string, string>, indent = ""): string {
  return Object.entries(map)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join("\n");
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n<!-- truncated -->";
}

/** Escape page-controlled text for a markdown table cell. */
function mdCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

/**
 * Build clone/CLONE.md — the deep, agent-oriented context document.
 */
export function buildCloneMarkdown(
  payload: ElementClonePayload,
  assets: SavedCloneAsset[],
  // Workspace-relative paths with forward slashes
  paths: {
    elementPng: string;
    pagePng: string;
    parentPng?: string;
    subtreeHtml: string;
    stylesCss: string;
    assetsDir: string;
    previewHtml?: string;
    zip?: string;
  }
): string {
  const d = payload.dimensions;
  const lines: string[] = [
    "# DaVinchi Full Element Clone Pack",
    "",
    "This folder is a **complete visual+structural capture** of a live DOM element,",
    "intended for an AI agent to **recreate the UI 1:1** in another project.",
    "",
    "## Summary",
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| Element | \`${mdCell(payload.selector || payload.tagName)}\` |`,
    `| Tag | \`${mdCell(payload.tagName)}\` |`,
    `| HTML path | \`${mdCell(payload.htmlPath || payload.selector)}\` |`,
    `| URL | ${mdCell(payload.url)} |`,
    `| Page title | ${mdCell(payload.title || "(none)")} |`,
    `| Box (viewport) | ${d.width}×${d.height} at (${d.left}, ${d.top}) |`,
    `| DPR | ${payload.devicePixelRatio ?? 1} |`,
    `| Captured | ${new Date().toISOString()} |`,
    `| Subtree HTML truncated | ${payload.subtreeTruncated ? "yes" : "no"} |`,
    `| Assets found | ${payload.assets.length} |`,
    `| Assets saved | ${assets.filter((a) => a.ok).length} |`,
    "",
    "## Files in this pack",
    "",
    "| File | Purpose |",
    "| --- | --- |",
    "| `CLONE.md` | This document — full clone brief |",
    "| `AGENT.md` | Ready-to-paste instruction for the coding agent |",
    "| `element.png` | Cropped screenshot of the target element |",
    "| `page.png` | Full-page screenshot for layout context |",
    "| `parent.png` | Parent container area (when available) |",
    "| `subtree.html` | Full outerHTML of the element subtree |",
    "| `styles.css` | Matched CSS + keyframes + font-face + deep rules |",
    "| `computed.json` | Resolved styles tree + ancestors + motion |",
    "| `fonts.json` | Fonts used in the subtree |",
    "| `assets/manifest.json` | Asset URL → local file map |",
    "| `assets/*` | Downloaded images, fonts, icons, etc. |",
    "| `meta.json` | Machine-readable metadata |",
    "| `preview.html` | Self-contained visual preview (if enabled) |",
    "| `../clone.zip` | Full pack archive (if enabled) |",
    "",
    "Relative paths from workspace:",
    "```",
    paths.elementPng,
    paths.pagePng,
    paths.parentPng || "(no parent.png)",
    paths.subtreeHtml,
    paths.stylesCss,
    paths.assetsDir,
    paths.previewHtml || "(preview.html disabled)",
    paths.zip || "(clone.zip disabled)",
    "```",
    "",
    "## Screenshots (look first)",
    "",
    "1. **element.png** — exact visual target",
    "2. **parent.png** — surrounding layout",
    "3. **page.png** — full page context",
    "",
    "Match colors, spacing, radii, shadows, and typography from the screenshots,",
    "not only from CSS numbers (computed values can differ from design tokens).",
    "",
    `**Sanity check:** element.png must be ≈ ${d.width}×${d.height}px (the Box above).`,
    "If it is much smaller or shows different content (sliders/carousels can move",
    "between pick and shot), use **parent.png** as the visual target instead.",
    "",
    "## Capture pitfalls (read before coding)",
    "",
    "- **Lazy-loaded images**: an `img.src` may point to a placeholder",
    "  (`dummy.png`, 1×1 gif) while the real file sits in `data-lazyload` /",
    "  `data-src` / `srcset`. Map every original URL to its local file via",
    "  `assets/manifest.json`.",
    "- **Canvas**: `<canvas>` bitmaps are saved as PNG snapshots under `assets/`",
    "  (metadata in `computed.json` → `canvasDataUrls`). A canvas may have",
    "  `opacity: 0` inline while the engine paints it — trust the snapshot,",
    "  not the DOM state.",
    "- **Remote URLs in `subtree.html`** are kept as captured (often",
    "  protocol-relative `//host/…`); swap them for local `assets/*` files",
    "  using the manifest.",
    "",
    "## Dimensions",
    "",
    `- top: ${d.top}px`,
    `- left: ${d.left}px`,
    `- width: ${d.width}px`,
    `- height: ${d.height}px`,
    `- right: ${d.right}px`,
    `- bottom: ${d.bottom}px`,
    `- devicePixelRatio: ${payload.devicePixelRatio ?? 1}`,
    "",
  ];

  if (payload.pageMetrics) {
    const p = payload.pageMetrics;
    lines.push(
      "## Page metrics",
      "",
      `- viewport: ${p.viewportWidth}×${p.viewportHeight}`,
      `- scroll size: ${p.scrollWidth}×${p.scrollHeight}`,
      ""
    );
  }

  if (payload.canvasMetrics) {
    const c = payload.canvasMetrics;
    lines.push(
      "## Canvas metrics",
      "",
      `- CSS box: ${c.cssWidth}×${c.cssHeight}`,
      `- bitmap: ${c.bitmapWidth}×${c.bitmapHeight}`,
      `- attr: ${c.attrWidth ?? "—"}×${c.attrHeight ?? "—"}`,
      `- DPR: ${c.devicePixelRatio}`,
      `- scale: ${c.scaleX}×${c.scaleY} (expected ≈ ${c.expectedScale})`,
      `- status: ${c.status} — ${c.note}`,
      ""
    );
  }

  lines.push(
    "## Layout ancestors (closest parent first)",
    "",
    "Use these for flex/grid/positioning context. Do not reimplement the whole page —",
    "only the structure needed so the clone lays out the same way.",
    ""
  );

  if (!payload.ancestors?.length) {
    lines.push("_No ancestors captured._", "");
  } else {
    for (let i = 0; i < payload.ancestors.length; i++) {
      const a = payload.ancestors[i];
      lines.push(
        `### Ancestor ${i + 1}: \`${a.selector}\``,
        "",
        `- path: \`${a.htmlPath}\``,
        `- box: ${a.dimensions.width}×${a.dimensions.height} at (${a.dimensions.left}, ${a.dimensions.top})`,
        "",
        fence(
          [
            "/* resolved */",
            formatStyleMap(a.resolvedStyles) || "/* (empty) */",
            "",
            a.matchedCss?.trim() || "/* no matched rules */",
          ].join("\n"),
          "css"
        ),
        ""
      );
    }
  }

  lines.push(
    "## Root resolved styles",
    "",
    fence(formatStyleMap(payload.resolvedStyles) || "/* (empty) */", "css"),
    "",
    "### Inherited from parent",
    "",
    fence(formatStyleMap(payload.inheritedStyles || {}) || "/* (empty) */", "css"),
    "",
    "### CSS variables (deep)",
    "",
    fence(
      formatStyleMap(payload.deepCssVariables || payload.cssVariables || {}) ||
        "/* (empty) */",
      "css"
    ),
    ""
  );

  if (payload.pseudoElements) {
    lines.push("### Pseudo-elements", "");
    for (const [pe, map] of Object.entries(payload.pseudoElements)) {
      if (!map) continue;
      lines.push(fence(`${pe} {\n${formatStyleMap(map, "  ")}\n}`, "css"), "");
    }
  }

  if (payload.motionStyles && Object.keys(payload.motionStyles).length) {
    lines.push(
      "## Motion (animation / transition)",
      "",
      fence(formatStyleMap(payload.motionStyles), "css"),
      ""
    );
  }

  if (payload.keyframesCss?.trim()) {
    lines.push(
      "## Keyframes",
      "",
      fence(truncate(payload.keyframesCss.trim(), 40000), "css"),
      ""
    );
  }

  if (payload.fontFaceCss?.trim()) {
    lines.push(
      "## @font-face",
      "",
      fence(truncate(payload.fontFaceCss.trim(), 30000), "css"),
      ""
    );
  }

  if (payload.fonts?.length) {
    lines.push("## Fonts used", "");
    for (const f of payload.fonts) {
      lines.push(
        `- **${f.family}**` +
          (f.weight ? ` weight=${f.weight}` : "") +
          (f.style ? ` style=${f.style}` : "") +
          (f.source ? ` — ${f.source}` : "") +
          (f.status ? ` [${f.status}]` : "")
      );
    }
    lines.push("");
  }

  lines.push("## Assets", "");
  if (!assets.length) {
    lines.push("_No downloadable assets detected._", "");
  } else {
    lines.push("| Status | Kind | Local | Original |", "| --- | --- | --- | --- |");
    for (const a of assets) {
      lines.push(
        `| ${a.ok ? "OK" : "FAIL"} | ${mdCell(a.kind)} | \`${mdCell(a.localRel || "—")}\` | ${mdCell(a.originalUrl.slice(0, 120))} |`
      );
    }
    lines.push("");
  }

  if (payload.headLinks?.length) {
    lines.push("## Head links (fonts / icons)", "");
    for (const l of payload.headLinks) {
      lines.push(
        `- rel=\`${l.rel}\` href=\`${l.href}\`` +
          (l.as ? ` as=${l.as}` : "") +
          (l.type ? ` type=${l.type}` : "")
      );
    }
    lines.push("");
  }

  lines.push(
    "## Matched / deep CSS",
    "",
    "Full consolidated sheet is also in `styles.css`.",
    "",
    fence(
      truncate(
        (payload.deepCssText || payload.cssText || "").trim() || "/* (empty) */",
        80000
      ),
      "css"
    ),
    "",
    "## Style tree (key nodes)",
    ""
  );

  if (!payload.styleTree?.length) {
    lines.push("_Empty style tree._", "");
  } else {
    for (const node of payload.styleTree.slice(0, 40)) {
      lines.push(
        `### \`${node.selector}\` (depth ${node.depth})`,
        "",
        `- path: \`${node.htmlPath}\``,
        "",
        fence(formatStyleMap(node.resolvedStyles) || "/* (empty) */", "css"),
        ""
      );
    }
  }

  lines.push(
    "## Subtree HTML",
    "",
    "Full file: `subtree.html`. Preview below (may be truncated in this md):",
    "",
    fence(truncate(payload.subtreeHTML || payload.outerHTML || "", 60000), "html"),
    ""
  );

  if (payload.inlineSvgs?.length) {
    lines.push("## Inline SVGs", "");
    for (let i = 0; i < payload.inlineSvgs.length; i++) {
      lines.push(
        `### SVG ${i + 1}`,
        "",
        fence(truncate(payload.inlineSvgs[i], 8000), "svg"),
        ""
      );
    }
  }

  if (payload.canvasDataUrls?.length) {
    lines.push(
      "## Canvas snapshots",
      "",
      `${payload.canvasDataUrls.length} canvas data URL(s) saved under \`assets/\` when possible.`,
      "See `computed.json` → `canvasDataUrls` for metadata.",
      ""
    );
  }

  if (payload.innerText?.trim()) {
    lines.push(
      "## Inner text",
      "",
      fence(truncate(payload.innerText.trim(), 4000)),
      ""
    );
  }

  lines.push(
    "## Reproduction checklist for the agent",
    "",
    "1. Open **element.png** and match the visual exactly (if its size differs from the Box in Summary, use **parent.png** as the reference).",
    "2. Rebuild structure from **subtree.html** (semantic HTML preferred over inline soup when possible).",
    "3. Apply layout from ancestor resolved styles (flex/grid/gap/padding).",
    "4. Port colors, radii, shadows, fonts from resolved + CSS variables.",
    "5. Copy motion (transition/animation + keyframes) if present.",
    "6. Replace remote asset URLs with local `assets/*` files from the manifest.",
    "7. Verify against **parent.png** / **page.png** for spacing in context.",
    "8. Prefer modern CSS (flex/grid, custom properties) over pixel-perfect inline styles dump — unless the dump is the only source of truth.",
    ""
  );

  return lines.join("\n");
}

/**
 * Ready-to-paste agent instruction.
 */
export function buildAgentMarkdown(
  payload: ElementClonePayload,
  pick: SavedPick
): string {
  const cloneRel = pick.cloneDirPath
    ? relHint(pick.cloneDirPath)
    : `${getOutputDirName()}/…/clone`;
  return [
    "# Agent task: clone this UI element 1:1",
    "",
    "You are given a **DaVinchi full clone pack** captured from a live website.",
    "Recreate this UI element in the **current project** so it looks and behaves the same.",
    "",
    "## Goal",
    "",
    `- Rebuild: \`${payload.selector || payload.tagName}\``,
    `- Source URL: ${payload.url}`,
    `- Target visual size ≈ **${payload.dimensions.width}×${payload.dimensions.height}px**`,
    "",
    "## Inputs (read all)",
    "",
    "```",
    `${cloneRel}/CLONE.md`,
    `${cloneRel}/element.png`,
    `${cloneRel}/page.png`,
    `${cloneRel}/parent.png`,
    `${cloneRel}/subtree.html`,
    `${cloneRel}/styles.css`,
    `${cloneRel}/computed.json`,
    `${cloneRel}/fonts.json`,
    `${cloneRel}/assets/manifest.json`,
    `${cloneRel}/assets/*`,
    pick.previewHtmlPath ? `${cloneRel}/preview.html` : null,
    pick.zipPath || null,
    "```",
    "",
    "Also available (lighter pick):",
    "```",
    pick.contextPath,
    pick.imagePath,
    "```",
    "",
    "## Requirements",
    "",
    "1. **Visual fidelity first** — match screenshot (colors, spacing, type, shadows, radii).",
    `2. **Check the reference**: element.png must be ≈ ${payload.dimensions.width}×${payload.dimensions.height}px; if it differs (animated sliders can move between pick and shot), use parent.png as the visual target.`,
    "3. Implement as clean components in this repo’s stack (do not paste huge vendor bundles unless necessary).",
    "4. Use local assets from `assets/` (see manifest). Download failures: note and approximate. Lazy-load aware: `img.src` may be a placeholder (`dummy.png`), the real file is mapped in the manifest (from `data-lazyload`/`data-src`).",
    "5. Preserve interactive affordances visible in the capture (buttons, progress, hover styles if documented).",
    "6. If the element is a chart/canvas engine: recreate the **look** from the canvas snapshot in `assets/` (see `computed.json` → `canvasDataUrls`); a canvas can be `opacity: 0` in the DOM while the engine paints it. Full engine port only if required.",
    "7. Do not invent missing content; use captured text/structure.",
    "8. When done, show a side-by-side checklist vs the reference screenshot.",
    "",
    "## Constraints",
    "",
    "- Prefer project design tokens if they already exist; map clone colors onto tokens when close.",
    "- Keep accessibility basics (contrast, labels) unless the original is purely decorative.",
    "",
    "## Start",
    "",
    "1. Read `CLONE.md` fully.",
    "2. Open `element.png` (and `preview.html` if present); verify its size against the target size above, fall back to `parent.png` on mismatch.",
    "3. Propose file plan → implement → verify against screenshots.",
    "",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}

function relHint(absPath: string): string {
  // Best-effort display path; host already has absolute paths for agents.
  const norm = absPath.replace(/\\/g, "/");
  const marker = `${getOutputDirName().replace(/\\/g, "/")}/`;
  const idx = norm.lastIndexOf(marker);
  if (idx >= 0) return norm.slice(idx);
  return norm;
}

/** Machine-readable meta.json content. */
export function buildCloneMeta(payload: ElementClonePayload): Record<string, unknown> {
  return {
    version: 1,
    kind: "davinci-element-clone",
    capturedAt: new Date().toISOString(),
    selector: payload.selector,
    tagName: payload.tagName,
    htmlPath: payload.htmlPath,
    url: payload.url,
    title: payload.title,
    dimensions: payload.dimensions,
    devicePixelRatio: payload.devicePixelRatio,
    pageMetrics: payload.pageMetrics,
    parentDimensions: payload.parentDimensions,
    subtreeTruncated: payload.subtreeTruncated,
    assetCount: payload.assets?.length ?? 0,
    fontCount: payload.fonts?.length ?? 0,
    styleNodeCount: payload.styleTree?.length ?? 0,
    ancestorCount: payload.ancestors?.length ?? 0,
    canvasMetrics: payload.canvasMetrics ?? null,
  };
}

/** computed.json payload. */
export function buildComputedJson(payload: ElementClonePayload): Record<string, unknown> {
  return {
    root: {
      selector: payload.selector,
      resolvedStyles: payload.resolvedStyles,
      inheritedStyles: payload.inheritedStyles,
      cssVariables: payload.deepCssVariables || payload.cssVariables,
      pseudoElements: payload.pseudoElements,
      motionStyles: payload.motionStyles,
    },
    ancestors: payload.ancestors,
    styleTree: payload.styleTree,
    canvasDataUrls: (payload.canvasDataUrls || []).map((c) => ({
      selector: c.selector,
      width: c.width,
      height: c.height,
      // Omit huge data URLs from JSON if too large; they may be on disk.
      dataUrlChars: c.dataUrl?.length ?? 0,
      hasDataUrl: !!(c.dataUrl && c.dataUrl.length > 32),
    })),
  };
}
