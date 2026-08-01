/**
 * Injected into the target page. Runs in browser context (no Node APIs).
 * Returns a self-executing function source for page.evaluate / addInitScript.
 */
export function getPickerBootstrapSource(): string {
  return `(() => {
  const HIGHLIGHT_ID = '__element-picker-highlight';
  const LABEL_ID = '__element-picker-label';
  const STYLE_ID = '__element-picker-style';

  /** Always (re)bind capture helpers — works even if picker was installed earlier. */
  function bindCaptureApis() {
    window.__elementPickerHideForCapture = () => {
      const box = document.getElementById(HIGHLIGHT_ID);
      const label = document.getElementById(LABEL_ID);
      if (box) box.style.display = 'none';
      if (label) label.style.display = 'none';
      document.documentElement.classList.remove('__element-picker-on');
      void document.documentElement.offsetHeight;
      return true;
    };
    window.__elementPickerRestoreAfterCapture = () => {
      const st = window.__elementPickerState;
      if (st && st.selectMode) {
        document.documentElement.classList.add('__element-picker-on');
      }
      // Next mousemove repaints outline; keep screenshot clean until then
      return !!(st && st.selectMode);
    };
  }

  if (window.__elementPickerInstalled) {
    bindCaptureApis();
    return window.__elementPickerState || { selectMode: false };
  }
  window.__elementPickerInstalled = true;
  window.__elementPickerState = { selectMode: false };

  const STATE = window.__elementPickerState;

  function ensureUi() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = \`
        #\${HIGHLIGHT_ID} {
          position: fixed !important;
          pointer-events: none !important;
          z-index: 2147483646 !important;
          border: 2px solid #4fc3f7 !important;
          background: rgba(79, 195, 247, 0.12) !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          display: none;
        }
        #\${LABEL_ID} {
          position: fixed !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
          background: #0b0e14 !important;
          color: #4fc3f7 !important;
          font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
          padding: 2px 6px !important;
          border-radius: 3px !important;
          border: 1px solid #4fc3f7 !important;
          max-width: 60vw !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          display: none;
        }
        html.__element-picker-on, html.__element-picker-on * {
          cursor: crosshair !important;
        }
      \`;
      (document.head || document.documentElement).appendChild(style);
    }
    let box = document.getElementById(HIGHLIGHT_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = HIGHLIGHT_ID;
      document.documentElement.appendChild(box);
    }
    let label = document.getElementById(LABEL_ID);
    if (!label) {
      label = document.createElement('div');
      label.id = LABEL_ID;
      document.documentElement.appendChild(label);
    }
    return { box, label };
  }

  function isOurUi(el) {
    if (!el || el === document.documentElement || el === document.body) return true;
    const id = el.id;
    return id === HIGHLIGHT_ID || id === LABEL_ID || id === STYLE_ID;
  }

  function cssEscape(value) {
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
  }

  function isPickerClass(name) {
    return name === '__element-picker-on' || name.indexOf('__element-picker') === 0;
  }

  function shortSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && el.id !== HIGHLIGHT_ID && el.id !== LABEL_ID && el.id !== STYLE_ID) {
      return el.tagName.toLowerCase() + '#' + cssEscape(el.id);
    }
    const cls = (el.className && typeof el.className === 'string')
      ? el.className.trim().split(/\\s+/).filter((c) => c && !isPickerClass(c)).slice(0, 3)
      : [];
    if (cls.length) return el.tagName.toLowerCase() + '.' + cls.map(cssEscape).join('.');
    return el.tagName.toLowerCase();
  }

  function htmlPath(el) {
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 12) {
      parts.unshift(shortSelector(cur));
      if (cur.id) break;
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  const RESOLVED_PROPS = [
    'display', 'position', 'box-sizing', 'width', 'height', 'max-width', 'max-height',
    'margin', 'padding', 'border', 'border-radius',
    'color', 'background-color', 'background', 'opacity',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-decoration', 'white-space',
    'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'overflow', 'z-index', 'cursor', 'transform',
    'box-shadow', 'column-gap', 'row-gap', 'unicode-bidi', 'font-stretch',
    'font-feature-settings', 'font-kerning', 'font-size-adjust'
  ];

  /** Skip resolved values that equal common CSS initials / no-ops. */
  const BORING_RESOLVED = {
    'position': ['static'],
    'max-width': ['none'],
    'max-height': ['none'],
    'margin': ['0px'],
    'border-radius': ['0px'],
    'opacity': ['1'],
    'font-style': ['normal'],
    'letter-spacing': ['normal'],
    'text-decoration': ['none', 'none solid rgb(0, 0, 0)', 'rgb(0, 0, 0)'],
    'white-space': ['normal'],
    'flex': ['0 1 auto'],
    'flex-direction': ['row'],
    'flex-wrap': ['nowrap'],
    'justify-content': ['normal'],
    'align-items': ['normal'],
    'gap': ['normal'],
    'grid-template-columns': ['none'],
    'overflow': ['visible'],
    'z-index': ['auto'],
    'transform': ['none'],
    'box-shadow': ['none'],
    'column-gap': ['normal'],
    'row-gap': ['normal'],
    'unicode-bidi': ['normal'],
    'font-stretch': ['100%', 'normal'],
    'font-feature-settings': ['normal'],
    'font-kerning': ['auto'],
    'font-size-adjust': ['none'],
    'background-color': ['rgba(0, 0, 0, 0)', 'transparent'],
    'background': [
      'rgba(0, 0, 0, 0) none repeat scroll 0% 0% / auto padding-box border-box',
      'none',
      'transparent'
    ]
  };

  const INHERITED_PROPS = [
    'color', 'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-align', 'visibility', 'cursor'
  ];

  const PSEUDO_EL_PROPS = [
    'content', 'display', 'position', 'width', 'height', 'top', 'right', 'bottom', 'left',
    'margin', 'padding', 'border', 'border-radius', 'color', 'background', 'background-color',
    'opacity', 'font-size', 'font-weight', 'line-height', 'transform', 'box-shadow', 'z-index'
  ];

  function isBoringResolved(prop, value) {
    if (!value) return true;
    const v = value.trim();
    const list = BORING_RESOLVED[prop];
    if (list && list.indexOf(v) !== -1) return true;
    // text-decoration: none solid <color>
    if (prop === 'text-decoration' && /^none\\b/.test(v)) return true;
    // empty border shorthand
    if (prop === 'border' && /^0px\\s+none\\b/.test(v)) return true;
    // Generic no-ops
    if (v === 'normal' || v === 'none' || v === 'auto') {
      if (prop === 'width' || prop === 'height' || prop === 'display' || prop === 'cursor' ||
          prop === 'color' || prop === 'font-family' || prop === 'font-size' || prop === 'font-weight' ||
          prop === 'line-height' || prop === 'text-align' || prop === 'padding' || prop === 'border' ||
          prop === 'flex' || prop === 'gap') {
        return false;
      }
      return true;
    }
    return false;
  }

  function collectResolved(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of RESOLVED_PROPS) {
      try {
        const v = cs.getPropertyValue(p);
        if (!v) continue;
        const t = v.trim();
        if (isBoringResolved(p, t)) continue;
        out[p] = t;
      } catch (_) { /* ignore */ }
    }
    return out;
  }

  function collectInherited(el) {
    const parent = el.parentElement;
    if (!parent) return {};
    const cs = getComputedStyle(parent);
    const out = {};
    for (const p of INHERITED_PROPS) {
      try {
        const v = cs.getPropertyValue(p);
        if (v) out[p] = v.trim();
      } catch (_) { /* ignore */ }
    }
    return out;
  }

  function collectCssVariables(el) {
    const cs = getComputedStyle(el);
    const out = {};
    // Walk stylesheets for var(--x) references is heavy; sample common vars from computed style of el + :root
    const roots = [document.documentElement, el];
    for (const node of roots) {
      const style = getComputedStyle(node);
      for (let i = 0; i < style.length; i++) {
        const name = style.item(i);
        if (name && name.startsWith('--')) {
          const val = style.getPropertyValue(name).trim();
          if (val) out[name] = val;
        }
      }
    }
    // Also parse var() usages from a few key properties
    const probe = ['color', 'background-color', 'background', 'border-color', 'fill', 'stroke'];
    for (const p of probe) {
      const raw = cs.getPropertyValue(p);
      const re = /var\\((--[a-zA-Z0-9-_]+)/g;
      let m;
      while ((m = re.exec(raw))) {
        if (!(m[1] in out)) {
          const val = cs.getPropertyValue(m[1]).trim();
          if (val) out[m[1]] = val;
        }
      }
    }
    return out;
  }

  function collectPseudoElement(el, which) {
    try {
      const cs = getComputedStyle(el, which);
      const content = (cs.getPropertyValue('content') || '').trim();
      if (!content || content === 'none' || content === 'normal') return null;
      const out = { content };
      for (const p of PSEUDO_EL_PROPS) {
        if (p === 'content') continue;
        try {
          const v = cs.getPropertyValue(p);
          if (!v) continue;
          const t = v.trim();
          if (isBoringResolved(p, t)) continue;
          out[p] = t;
        } catch (_) { /* ignore */ }
      }
      return out;
    } catch (_) {
      return null;
    }
  }

  function sheetSourceLabel(sheet) {
    try {
      if (sheet.href) {
        try {
          const u = new URL(sheet.href, location.href);
          const path = u.pathname || '';
          const base = path.split('/').filter(Boolean).pop();
          return base || u.href;
        } catch (_) {
          return String(sheet.href);
        }
      }
      const node = sheet.ownerNode;
      if (node) {
        if (node.id === STYLE_ID) return null;
        if (node.id) return '<style#' + node.id + '>';
        if ((node.tagName || '').toLowerCase() === 'style') return '<style>';
      }
    } catch (_) { /* ignore */ }
    return '(inline)';
  }

  /**
   * Strip state pseudos / pseudo-elements so we can match rules that only
   * apply under :hover, :focus, ::after, etc.
   */
  function stripStateAndPseudoEl(selector) {
    let s = String(selector);
    // Pseudo-elements first
    s = s.replace(/::(?:before|after|placeholder|marker|selection|backdrop|file-selector-button|first-line|first-letter|-webkit-[a-z-]+|[a-z-]+)/gi, '');
    // Common interactive / UI state pseudos (keep structural :nth-*, :not(), etc.)
    s = s.replace(/:(?:hover|focus|focus-visible|focus-within|active|visited|disabled|enabled|checked|indeterminate|target|link|any-link|default|optional|required|valid|invalid|read-only|read-write|placeholder-shown|fullscreen|modal|user-invalid|user-valid)/gi, '');
    s = s.replace(/\\s+/g, ' ').replace(/\\s*>\\s*/g, ' > ').trim();
    // Drop dangling combinators
    s = s.replace(/^[\\s>+~]+|[\\s>+~]+$/g, '').trim();
    return s;
  }

  function classifySelectorMatch(el, selectorText) {
    const raw = String(selectorText || '');
    if (!raw || raw.indexOf('__element-picker') !== -1) return null;
    const parts = raw.split(',');
    let best = null;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      try {
        if (el.matches(part)) {
          return { kind: 'exact', selector: part };
        }
      } catch (_) { /* invalid */ }
      const stripped = stripStateAndPseudoEl(part);
      if (!stripped || stripped === part) continue;
      try {
        if (el.matches(stripped)) {
          const isPseudoEl = /::(?:before|after|placeholder|marker)/i.test(part);
          const kind = isPseudoEl ? 'pseudo-element' : 'state';
          // Prefer exact; otherwise keep first state/pseudo hit
          if (!best) best = { kind, selector: part };
        }
      } catch (_) { /* invalid */ }
    }
    return best;
  }

  function formatRuleBlock(source, mediaStack, ruleCssText, kindNote) {
    const media = mediaStack.filter(Boolean).join(' and ');
    let header = '/* ' + source;
    if (media) header += ' | @media ' + media;
    if (kindNote) header += ' | ' + kindNote;
    header += ' */';
    return header + '\\n' + ruleCssText;
  }

  function walkStyleRules(rules, mediaStack, source, visit) {
    if (!rules) return;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      try {
        // CSSMediaRule
        if (rule.type === 4 /* MEDIA_RULE */ || (rule.media && rule.cssRules)) {
          const cond = rule.conditionText || (rule.media && rule.media.mediaText) || '';
          walkStyleRules(rule.cssRules, mediaStack.concat([cond]), source, visit);
          continue;
        }
        // CSSSupportsRule / CSSLayerBlockRule / grouping with nested cssRules
        if (rule.cssRules && !rule.selectorText) {
          walkStyleRules(rule.cssRules, mediaStack, source, visit);
          continue;
        }
        if (!rule.selectorText) continue;
        visit(rule, mediaStack, source);
      } catch (_) { /* skip rule */ }
    }
  }

  function collectMatchedRulesForElement(el, limit) {
    const found = [];
    const seen = Object.create(null);
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        const source = sheetSourceLabel(sheet);
        if (source === null) continue;
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        walkStyleRules(rules, [], source, (rule, mediaStack, src) => {
          if (found.length >= limit) return;
          const hit = classifySelectorMatch(el, rule.selectorText);
          if (!hit) return;
          const key = src + '\\0' + mediaStack.join('|') + '\\0' + rule.cssText;
          if (seen[key]) return;
          seen[key] = true;
          let note = '';
          if (hit.kind === 'state') note = 'state (not necessarily active now)';
          else if (hit.kind === 'pseudo-element') note = 'pseudo-element rule';
          found.push(formatRuleBlock(src, mediaStack, rule.cssText, note));
        });
        if (found.length >= limit) break;
      }
    } catch (_) { /* ignore */ }
    return found;
  }

  function elementClasses(el) {
    if (!el || !el.className || typeof el.className !== 'string') return [];
    return el.className.trim().split(/\\s+/).filter((c) => c && !isPickerClass(c));
  }

  function sharesClass(a, b) {
    const ca = elementClasses(a);
    if (!ca.length) return false;
    const set = Object.create(null);
    for (const c of ca) set[c] = true;
    const cb = elementClasses(b);
    for (const c of cb) if (set[c]) return true;
    return false;
  }

  function collectCssText(el) {
    const sections = [];
    const OWN_LIMIT = 40;
    const CHILD_LIMIT = 30;
    const VARIANT_LIMIT = 20;

    // Inline style first
    if (el.getAttribute('style')) {
      sections.push(
        '/* (inline style) */\\n' + shortSelector(el) + ' { ' + el.getAttribute('style') + ' }'
      );
    }

    const own = collectMatchedRulesForElement(el, OWN_LIMIT);
    if (own.length) {
      sections.push('/* === Matched rules (element) === */');
      sections.push(own.join('\\n\\n'));
    }

    // Direct children — matched rules (dedupe by cssText+source header)
    try {
      const kids = el.children ? Array.from(el.children) : [];
      const maxKids = Math.min(kids.length, 8);
      const childSeen = Object.create(null);
      const childBlocks = [];
      let childRuleCount = 0;
      for (let i = 0; i < maxKids; i++) {
        const kid = kids[i];
        if (isOurUi(kid)) continue;
        const rules = collectMatchedRulesForElement(kid, 12);
        if (!rules.length) continue;
        const label = shortSelector(kid);
        const unique = [];
        for (const r of rules) {
          if (childSeen[r]) continue;
          childSeen[r] = true;
          unique.push(r);
          childRuleCount++;
          if (childRuleCount >= CHILD_LIMIT) break;
        }
        if (unique.length) {
          childBlocks.push('/* --- child: ' + label + ' --- */\\n' + unique.join('\\n\\n'));
        }
        if (childRuleCount >= CHILD_LIMIT) break;
      }
      if (childBlocks.length) {
        sections.push('/* === Matched rules (direct children) === */');
        sections.push(childBlocks.join('\\n\\n'));
      }
    } catch (_) { /* ignore */ }

    // Sibling class variants (e.g. .tab.active when picking inactive .tab)
    try {
      const parent = el.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children);
        const variantSeen = Object.create(null);
        // Seed with own rules so we don't repeat
        for (const r of own) variantSeen[r] = true;
        const variantBlocks = [];
        let vcount = 0;
        for (let i = 0; i < sibs.length && vcount < VARIANT_LIMIT; i++) {
          const sib = sibs[i];
          if (sib === el || isOurUi(sib)) continue;
          if (!sharesClass(el, sib)) continue;
          // Prefer siblings that have extra classes (active/disabled/…)
          const extra = elementClasses(sib).filter((c) => elementClasses(el).indexOf(c) === -1);
          if (!extra.length && sib.className === el.className) continue;
          const rules = collectMatchedRulesForElement(sib, 10);
          const unique = [];
          for (const r of rules) {
            if (variantSeen[r]) continue;
            variantSeen[r] = true;
            unique.push(r);
            vcount++;
            if (vcount >= VARIANT_LIMIT) break;
          }
          if (unique.length) {
            variantBlocks.push(
              '/* --- sibling variant: ' + shortSelector(sib) +
              (extra.length ? ' (+.' + extra.join('.+.') + ')' : '') +
              ' --- */\\n' + unique.join('\\n\\n')
            );
          }
        }
        if (variantBlocks.length) {
          sections.push('/* === Related sibling variants === */');
          sections.push(variantBlocks.join('\\n\\n'));
        }
      }
    } catch (_) { /* ignore */ }

    // Pseudo-elements computed styles
    try {
      const peBlocks = [];
      for (const pe of ['::before', '::after']) {
        const map = collectPseudoElement(el, pe);
        if (!map) continue;
        const lines = Object.keys(map).map((k) => '  ' + k + ': ' + map[k] + ';');
        peBlocks.push(pe + ' {\\n' + lines.join('\\n') + '\\n}');
      }
      if (peBlocks.length) {
        sections.push('/* === Pseudo-elements (computed) === */');
        sections.push(peBlocks.join('\\n'));
      }
    } catch (_) { /* ignore */ }

    return sections.join('\\n\\n');
  }

  /** Hide cyan overlay + label so screenshots stay clean. */
  function hideOverlay() {
    const box = document.getElementById(HIGHLIGHT_ID);
    const label = document.getElementById(LABEL_ID);
    if (box) box.style.display = 'none';
    if (label) label.style.display = 'none';
  }

  /**
   * Temporarily strip picker UI chrome so payload/screenshot
   * do not include outline, crosshair cursor, or picker CSS.
   */
  function withCleanPage(fn) {
    const hadClass = document.documentElement.classList.contains('__element-picker-on');
    hideOverlay();
    if (hadClass) {
      document.documentElement.classList.remove('__element-picker-on');
    }
    // Force reflow so computed styles update before we read them / screenshot
    void document.documentElement.offsetHeight;
    try {
      return fn();
    } finally {
      if (hadClass && STATE.selectMode) {
        document.documentElement.classList.add('__element-picker-on');
      }
    }
  }

  function paintHighlight(el) {
    const { box, label } = ensureUi();
    if (!el || isOurUi(el)) {
      box.style.display = 'none';
      label.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.top = r.top + 'px';
    box.style.left = r.left + 'px';
    box.style.width = Math.max(0, r.width) + 'px';
    box.style.height = Math.max(0, r.height) + 'px';
    const text = shortSelector(el);
    label.textContent = text;
    label.style.display = 'block';
    let top = r.top - 22;
    if (top < 0) top = r.bottom + 4;
    let left = r.left;
    if (left < 0) left = 0;
    label.style.top = top + 'px';
    label.style.left = left + 'px';
  }

  /**
   * Canvas blur checklist: CSS box vs bitmap (width/height attrs) vs DPR.
   * Returns null for non-canvas elements.
   */
  function collectCanvasMetrics(el) {
    if (!el || (el.tagName || '').toLowerCase() !== 'canvas') return null;
    try {
      const dpr = window.devicePixelRatio || 1;
      const r = el.getBoundingClientRect();
      const cssW = el.clientWidth || r.width || 0;
      const cssH = el.clientHeight || r.height || 0;
      const bmpW = el.width | 0;
      const bmpH = el.height | 0;
      let attrW = null;
      let attrH = null;
      try {
        const aw = el.getAttribute('width');
        const ah = el.getAttribute('height');
        if (aw !== null && aw !== '') attrW = Number(aw);
        if (ah !== null && ah !== '') attrH = Number(ah);
      } catch (_) { /* ignore */ }
      const scaleX = cssW > 0 ? bmpW / cssW : 0;
      const scaleY = cssH > 0 ? bmpH / cssH : 0;
      const tol = 0.08;
      function classify(scale) {
        if (!(scale > 0)) return 'unknown';
        if (scale < dpr * (1 - tol)) return 'under-scaled';
        if (scale > dpr * (1 + tol)) return 'over-scaled';
        return 'ok';
      }
      const cx = classify(scaleX);
      const cy = classify(scaleY);
      let status = 'ok';
      if (cx === 'under-scaled' || cy === 'under-scaled') status = 'under-scaled';
      else if (cx === 'over-scaled' || cy === 'over-scaled') status = 'over-scaled';
      else if (cx === 'unknown' || cy === 'unknown') status = 'unknown';
      let note = 'Bitmap matches CSS × DPR (±8%)';
      if (status === 'under-scaled') {
        note = 'Bitmap smaller than CSS × DPR — likely blurry on hi-DPI';
      } else if (status === 'over-scaled') {
        note = 'Bitmap larger than CSS × DPR — extra memory / oversampling';
      } else if (status === 'unknown') {
        note = 'Could not compute scale (zero CSS size?)';
      }
      return {
        cssWidth: Math.round(cssW * 100) / 100,
        cssHeight: Math.round(cssH * 100) / 100,
        bitmapWidth: bmpW,
        bitmapHeight: bmpH,
        attrWidth: attrW,
        attrHeight: attrH,
        devicePixelRatio: dpr,
        scaleX: Math.round(scaleX * 1000) / 1000,
        scaleY: Math.round(scaleY * 1000) / 1000,
        expectedScale: dpr,
        status: status,
        note: note
      };
    } catch (_) {
      return null;
    }
  }

  function buildPayload(el) {
    const r = el.getBoundingClientRect();
    let outer = '';
    try { outer = el.outerHTML || ''; } catch (_) { outer = ''; }
    let innerText = '';
    try { innerText = (el.innerText || '').slice(0, 500); } catch (_) { innerText = ''; }
    return {
      tagName: (el.tagName || '').toLowerCase(),
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      selector: shortSelector(el),
      htmlPath: htmlPath(el),
      outerHTML: outer,
      innerText,
      url: location.href,
      title: document.title || '',
      dimensions: {
        top: Math.round(r.top),
        left: Math.round(r.left),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom)
      },
      devicePixelRatio: window.devicePixelRatio || 1,
      cssText: collectCssText(el),
      resolvedStyles: collectResolved(el),
      cssVariables: collectCssVariables(el),
      inheritedStyles: collectInherited(el),
      canvasMetrics: collectCanvasMetrics(el)
    };
  }

  let lastEl = null;

  function onMove(e) {
    if (!STATE.selectMode) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurUi(el)) {
      lastEl = null;
      paintHighlight(null);
      return;
    }
    // Prefer the deepest non-our element
    lastEl = el;
    paintHighlight(el);
  }

  function onClick(e) {
    if (!STATE.selectMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurUi(el)) return;
    lastEl = el;
    // Hide cyan outline + strip picker class before collecting styles
    // (screenshot on host also hides overlay again right before capture)
    const payload = withCleanPage(() => buildPayload(el));
    // Keep overlay hidden until host finishes screenshot; restore via API
    if (typeof window.__elementPickerOnPick === 'function') {
      window.__elementPickerOnPick(payload);
    }
  }

  function onKey(e) {
    if (e.key === 'Escape' && STATE.selectMode) {
      setSelectMode(false);
      if (typeof window.__elementPickerOnModeChange === 'function') {
        window.__elementPickerOnModeChange(false);
      }
    }
  }

  function setSelectMode(on) {
    STATE.selectMode = !!on;
    document.documentElement.classList.toggle('__element-picker-on', STATE.selectMode);
    if (!STATE.selectMode) {
      lastEl = null;
      paintHighlight(null);
    }
    return STATE.selectMode;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', () => {
    if (STATE.selectMode && lastEl) paintHighlight(lastEl);
  }, true);
  window.addEventListener('resize', () => {
    if (STATE.selectMode && lastEl) paintHighlight(lastEl);
  }, true);

  window.__elementPickerSetMode = setSelectMode;
  window.__elementPickerGetMode = () => STATE.selectMode;
  bindCaptureApis();
  // Prefer full restore with lastEl when this install owns the listeners
  window.__elementPickerRestoreAfterCapture = () => {
    if (STATE.selectMode) {
      document.documentElement.classList.add('__element-picker-on');
      if (lastEl && document.contains(lastEl)) {
        paintHighlight(lastEl);
      }
    }
    return STATE.selectMode;
  };

  ensureUi();
  return STATE;
})()`;
}

/** Evaluate helper: set select mode true/false. */
export function getSetModeSource(on: boolean): string {
  return `(() => {
    if (typeof window.__elementPickerSetMode === 'function') {
      return window.__elementPickerSetMode(${on ? "true" : "false"});
    }
    return false;
  })()`;
}

/** Hide highlight overlay before taking a screenshot. */
export function getHideForCaptureSource(): string {
  return `(() => {
    if (typeof window.__elementPickerHideForCapture === 'function') {
      return window.__elementPickerHideForCapture();
    }
    const box = document.getElementById('__element-picker-highlight');
    const label = document.getElementById('__element-picker-label');
    if (box) box.style.display = 'none';
    if (label) label.style.display = 'none';
    document.documentElement.classList.remove('__element-picker-on');
    return true;
  })()`;
}

/** Restore select-mode visuals after screenshot. */
export function getRestoreAfterCaptureSource(): string {
  return `(() => {
    if (typeof window.__elementPickerRestoreAfterCapture === 'function') {
      return window.__elementPickerRestoreAfterCapture();
    }
    return false;
  })()`;
}
