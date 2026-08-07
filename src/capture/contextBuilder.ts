import type { ElementPickPayload } from "../types";

function truncateHtml(html: string, maxBytes: number): string {
  const buf = Buffer.from(html, "utf8");
  if (buf.byteLength <= maxBytes) {
    return html;
  }
  // Truncate by bytes, re-decode safely
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end--;
  }
  return buf.subarray(0, end).toString("utf8") + "\n<!-- truncated -->";
}

function formatStyleMap(map: Record<string, string>, indent = ""): string {
  return Object.entries(map)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join("\n");
}

/**
 * Wrap content in a code fence longer than any backtick run inside it,
 * so page-controlled content cannot terminate the fence early.
 */
export function fence(content: string, lang = ""): string {
  let longest = 2;
  const runs = content.match(/`+/g);
  if (runs) {
    for (const r of runs) {
      if (r.length > longest) longest = r.length;
    }
  }
  const marker = "`".repeat(longest + 1);
  return `${marker}${lang}\n${content}\n${marker}`;
}

/**
 * Build a context markdown document close to Copilot's
 * "Attached Element Context from Integrated Browser" format.
 */
export function buildContextMarkdown(
  payload: ElementPickPayload,
  maxHtmlBytes: number
): string {
  const html = truncateHtml(payload.outerHTML || "", maxHtmlBytes);
  const d = payload.dimensions;

  const lines: string[] = [
    "Attached Element Context from DaVinchi Element Picker",
    "",
    `Element: ${payload.selector || payload.tagName}`,
    "",
    `URL: ${payload.url}`,
    "",
    `HTML Path: ${payload.htmlPath || payload.selector}`,
    "",
    "Outer HTML:",
    fence(html, "html"),
    "",
    "Dimensions:",
    `- top: ${d.top}px`,
    `- left: ${d.left}px`,
    `- width: ${d.width}px`,
    `- height: ${d.height}px`,
    `- devicePixelRatio: ${payload.devicePixelRatio ?? 1}`,
    "",
  ];

  if (payload.canvasMetrics) {
    const c = payload.canvasMetrics;
    lines.push(
      "Canvas metrics:",
      `- CSS box: ${c.cssWidth}×${c.cssHeight}`,
      `- bitmap (canvas.width×height): ${c.bitmapWidth}×${c.bitmapHeight}`,
      `- attribute width/height: ${c.attrWidth ?? "—"}×${c.attrHeight ?? "—"}`,
      `- devicePixelRatio: ${c.devicePixelRatio}`,
      `- scale (bitmap/CSS): ${c.scaleX}×${c.scaleY} (expected ≈ ${c.expectedScale})`,
      `- status: ${c.status}`,
      `- note: ${c.note}`,
      ""
    );
  }

  const cssParts: string[] = [];

  if (payload.cssText?.trim()) {
    cssParts.push(payload.cssText.trim(), "");
  }

  if (payload.inheritedStyles && Object.keys(payload.inheritedStyles).length) {
    cssParts.push("/* Inherited */", formatStyleMap(payload.inheritedStyles), "");
  }

  if (payload.resolvedStyles && Object.keys(payload.resolvedStyles).length) {
    cssParts.push(
      "/* Resolved values (non-default) */",
      formatStyleMap(payload.resolvedStyles),
      ""
    );
  }

  if (payload.cssVariables && Object.keys(payload.cssVariables).length) {
    cssParts.push("/* CSS variables */", formatStyleMap(payload.cssVariables), "");
  }

  lines.push("CSS:", fence(cssParts.join("\n"), "css"));

  if (payload.innerText?.trim()) {
    lines.push("", "Inner text (truncated):", fence(payload.innerText.trim()));
  }

  lines.push("", `Page title: ${payload.title || "(none)"}`);
  lines.push(`Selector: ${payload.selector}`);
  lines.push(`Captured: ${new Date().toISOString()}`);
  lines.push("");

  return lines.join("\n");
}
