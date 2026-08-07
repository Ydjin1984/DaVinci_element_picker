/**
 * Injected into the target page. Runs in browser context (no Node APIs).
 * Returns a self-executing function source for page.evaluate / addInitScript.
 */
export function getPickerBootstrapSource(): string {
  return `(() => {
  const HIGHLIGHT_ID = '__element-picker-highlight';
  const LABEL_ID = '__element-picker-label';
  const STYLE_ID = '__element-picker-style';
  const PICKED_ATTR = 'data-davinchi-picked';

  /** Remove the pick-marker attribute from the tracked and any stray elements. */
  function clearPickedMarks() {
    try {
      const prev = window.__elementPickerPickedEl;
      if (prev && prev.removeAttribute) prev.removeAttribute(PICKED_ATTR);
    } catch (_) { /* ignore */ }
    window.__elementPickerPickedEl = null;
    try {
      const marked = document.querySelectorAll('[' + PICKED_ATTR + ']');
      for (let i = 0; i < marked.length; i++) marked[i].removeAttribute(PICKED_ATTR);
    } catch (_) { /* ignore */ }
  }

  /** Mark the picked element so screenshots target it exactly (set AFTER payload HTML is serialized). */
  function markPicked(el) {
    clearPickedMarks();
    try {
      el.setAttribute(PICKED_ATTR, '1');
      window.__elementPickerPickedEl = el;
    } catch (_) { /* ignore */ }
  }

  /** Always (re)bind capture helpers — works even if picker was installed earlier. */
  function bindCaptureApis() {
    window.__elementPickerHideForCapture = () => {
      const st = window.__elementPickerState;
      if (st) st.capturing = true;
      const box = document.getElementById(HIGHLIGHT_ID);
      const label = document.getElementById(LABEL_ID);
      if (box) box.style.display = 'none';
      if (label) label.style.display = 'none';
      document.documentElement.classList.remove('__element-picker-on');
      document.documentElement.classList.remove('__element-picker-clone');
      void document.documentElement.offsetHeight;
      return true;
    };
    window.__elementPickerRestoreAfterCapture = () => {
      const st = window.__elementPickerState;
      if (st) st.capturing = false;
      clearPickedMarks();
      if (st && (st.selectMode || st.cloneMode)) {
        document.documentElement.classList.add('__element-picker-on');
        if (st.cloneMode) {
          document.documentElement.classList.add('__element-picker-clone');
        } else {
          document.documentElement.classList.remove('__element-picker-clone');
        }
      }
      // Next mousemove repaints outline; keep screenshot clean until then
      return !!(st && (st.selectMode || st.cloneMode));
    };
    window.__elementPickerSetCloneOptions = (opts) => {
      const st = window.__elementPickerState;
      if (!st) return false;
      st.cloneFullSite = !!(opts && opts.fullSite);
      return true;
    };
  }

  const PICKER_VERSION = 4;
  if (window.__elementPickerInstalled === PICKER_VERSION) {
    bindCaptureApis();
    const st = window.__elementPickerState || { selectMode: false, cloneMode: false, capturing: false, cloneFullSite: false };
    if (typeof st.cloneMode === 'undefined') st.cloneMode = false;
    if (typeof st.capturing === 'undefined') st.capturing = false;
    if (typeof st.cloneFullSite === 'undefined') st.cloneFullSite = false;
    window.__elementPickerState = st;
    return st;
  }
  // Drop listeners from older inject versions before reinstalling
  try {
    const prev = window.__elementPickerHandlers;
    if (prev) {
      document.removeEventListener('mousemove', prev.onMove, true);
      document.removeEventListener('click', prev.onClick, true);
      document.removeEventListener('keydown', prev.onKey, true);
      if (prev.onScroll) window.removeEventListener('scroll', prev.onScroll, true);
      if (prev.onResize) window.removeEventListener('resize', prev.onResize, true);
    }
  } catch (_) { /* ignore */ }
  window.__elementPickerInstalled = PICKER_VERSION;
  window.__elementPickerState = window.__elementPickerState || { selectMode: false, cloneMode: false, capturing: false, cloneFullSite: false };
  window.__elementPickerState.selectMode = !!window.__elementPickerState.selectMode;
  window.__elementPickerState.cloneMode = !!window.__elementPickerState.cloneMode;
  window.__elementPickerState.capturing = !!window.__elementPickerState.capturing;
  window.__elementPickerState.cloneFullSite = !!window.__elementPickerState.cloneFullSite;

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
        html.__element-picker-clone #\${HIGHLIGHT_ID} {
          border-color: #ce93d8 !important;
          background: rgba(206, 147, 216, 0.14) !important;
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
        html.__element-picker-clone #\${LABEL_ID} {
          color: #ce93d8 !important;
          border-color: #ce93d8 !important;
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
    'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'color', 'background-color', 'background', 'background-image', 'background-size',
    'background-position', 'background-repeat', 'opacity',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'white-space',
    'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
    'gap', 'row-gap', 'column-gap',
    'grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'place-items',
    'overflow', 'overflow-x', 'overflow-y', 'z-index', 'cursor', 'transform',
    'box-shadow', 'filter', 'backdrop-filter', 'object-fit', 'object-position',
    'unicode-bidi', 'font-stretch', 'font-feature-settings', 'font-kerning', 'font-size-adjust',
    'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
    'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode',
    'transition', 'transition-property', 'transition-duration', 'transition-timing-function',
    'clip-path', 'mask-image', 'list-style', 'vertical-align', 'aspect-ratio',
    'inset', 'top', 'right', 'bottom', 'left', 'outline', 'visibility', 'pointer-events'
  ];

  const MOTION_PROPS = [
    'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
    'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode',
    'transition', 'transition-property', 'transition-duration', 'transition-timing-function',
    'transition-delay', 'transform', 'will-change'
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
          found.push(formatRuleBlock(src, mediaStack, absolutizeCssUrls(rule.cssText, ruleBaseUrl(rule, sheet)), note));
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
    const hadClone = document.documentElement.classList.contains('__element-picker-clone');
    hideOverlay();
    if (hadClass) {
      document.documentElement.classList.remove('__element-picker-on');
    }
    if (hadClone) {
      document.documentElement.classList.remove('__element-picker-clone');
    }
    // Force reflow so computed styles update before we read them / screenshot
    void document.documentElement.offsetHeight;
    try {
      return fn();
    } finally {
      if (hadClass && (STATE.selectMode || STATE.cloneMode)) {
        document.documentElement.classList.add('__element-picker-on');
        if (STATE.cloneMode) {
          document.documentElement.classList.add('__element-picker-clone');
        }
      }
    }
  }

  function paintHighlightLabelPrefix() {
    if (!STATE.cloneMode) return '';
    return STATE.cloneFullSite ? 'CLONE PAGE ' : 'CLONE ';
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
    const text = paintHighlightLabelPrefix() + shortSelector(el);
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
      canvasMetrics: collectCanvasMetrics(el),
      captureMode: 'select'
    };
  }

  function extractUrlsFromCssValue(value) {
    const out = [];
    if (!value) return out;
    const re = /url\\((['"]?)([^'")]+)\\1\\)/gi;
    let m;
    while ((m = re.exec(String(value)))) {
      const u = (m[2] || '').trim();
      if (u && u !== 'none') out.push(u);
    }
    return out;
  }

  function absUrl(u, base) {
    try {
      if (!u) return '';
      if (u.startsWith('data:') || u.startsWith('blob:')) return u;
      return new URL(u, base || location.href).href;
    } catch (_) {
      return u;
    }
  }

  /**
   * Relative url(...) inside a stylesheet resolves against the sheet's URL,
   * not the page URL — using location.href yields root-relative 404s
   * (e.g. /fonts/fontawesome-webfont.woff2 for a WP theme sheet).
   */
  function ruleBaseUrl(rule, sheet) {
    try {
      if (rule && rule.parentStyleSheet && rule.parentStyleSheet.href) {
        return rule.parentStyleSheet.href;
      }
    } catch (_) { /* ignore */ }
    try {
      if (sheet && sheet.href) return sheet.href;
    } catch (_) { /* ignore */ }
    return location.href;
  }

  /** Rewrite relative url(...) refs in a css text against the owning sheet. */
  function absolutizeCssUrls(cssText, base) {
    if (!cssText) return cssText;
    try {
      return String(cssText).replace(/url\\((['"]?)([^'")]+)\\1\\)/gi, function (m0, q, u) {
        const t = (u || '').trim();
        if (!t || t.indexOf('data:') === 0 || t.indexOf('blob:') === 0 || t.indexOf('#') === 0) {
          return m0;
        }
        return 'url(' + q + absUrl(t, base) + q + ')';
      });
    } catch (_) {
      return cssText;
    }
  }

  function collectDeepCssVariables(el, ancestors) {
    const out = {};
    const nodes = [document.documentElement, el];
    for (const a of ancestors) {
      if (a && a.node) nodes.push(a.node);
    }
    for (const node of nodes) {
      if (!node) continue;
      try {
        const style = getComputedStyle(node);
        for (let i = 0; i < style.length; i++) {
          const name = style.item(i);
          if (name && name.startsWith('--')) {
            const val = style.getPropertyValue(name).trim();
            if (val) out[name] = val;
          }
        }
      } catch (_) { /* ignore */ }
    }
    return out;
  }

  function collectMotion(el) {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of MOTION_PROPS) {
      try {
        const v = cs.getPropertyValue(p);
        if (!v) continue;
        const t = v.trim();
        if (!t || t === 'none' || t === 'normal' || t === '0s' || t === 'ease' || t === 'all') {
          if (p === 'transform' && t === 'none') continue;
          if (p.indexOf('animation') === 0 && (t === 'none' || t === 'normal' || t === '0s')) continue;
          if (p.indexOf('transition') === 0 && (t === 'none' || t === 'all' || t === '0s' || t === 'ease')) continue;
          if (p === 'will-change' && t === 'auto') continue;
        }
        if (t === 'none' || t === 'auto') continue;
        out[p] = t;
      } catch (_) { /* ignore */ }
    }
    return out;
  }

  function collectFontFaceCss() {
    const blocks = [];
    const seen = Object.create(null);
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        const source = sheetSourceLabel(sheet);
        if (source === null) continue;
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        walkStyleRulesForSpecial(rules, (rule) => {
          // CSSFontFaceRule type 5
          if (rule.type === 5 || (rule.cssText && /^@font-face/i.test(rule.cssText))) {
            const text = absolutizeCssUrls(rule.cssText, ruleBaseUrl(rule, sheet));
            if (seen[text]) return;
            seen[text] = true;
            blocks.push('/* ' + source + ' */\\n' + text);
          }
        });
      }
    } catch (_) { /* ignore */ }
    return blocks.join('\\n\\n');
  }

  function walkStyleRulesForSpecial(rules, visit) {
    if (!rules) return;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      try {
        if (rule.cssRules) {
          walkStyleRulesForSpecial(rule.cssRules, visit);
        }
        visit(rule);
      } catch (_) { /* skip */ }
    }
  }

  function collectKeyframesCss(animationNames) {
    const want = Object.create(null);
    for (const n of animationNames) {
      if (n && n !== 'none') want[n] = true;
    }
    const blocks = [];
    const seen = Object.create(null);
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        const source = sheetSourceLabel(sheet);
        if (source === null) continue;
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        walkStyleRulesForSpecial(rules, (rule) => {
          // CSSKeyframesRule type 7
          const isKf = rule.type === 7 || (rule.name && rule.cssText && /@keyframes/i.test(rule.cssText));
          if (!isKf) return;
          const name = rule.name || '';
          if (Object.keys(want).length && name && !want[name]) return;
          const text = absolutizeCssUrls(rule.cssText, ruleBaseUrl(rule, sheet));
          if (seen[text]) return;
          seen[text] = true;
          blocks.push('/* ' + source + ' */\\n' + text);
        });
      }
    } catch (_) { /* ignore */ }
    return blocks.join('\\n\\n');
  }

  function collectFontsUsed(root) {
    const fonts = [];
    const seen = Object.create(null);
    try {
      if (document.fonts && document.fonts.forEach) {
        document.fonts.forEach((f) => {
          const key = (f.family || '') + '|' + (f.weight || '') + '|' + (f.style || '');
          if (seen[key]) return;
          seen[key] = true;
          fonts.push({
            family: f.family || '',
            weight: String(f.weight || ''),
            style: f.style || '',
            stretch: f.stretch || '',
            status: f.status || '',
            source: 'document.fonts'
          });
        });
      }
    } catch (_) { /* ignore */ }
    // Also sample font-family from subtree nodes
    try {
      const nodes = [root].concat(Array.from(root.querySelectorAll('*')).slice(0, 80));
      for (const n of nodes) {
        try {
          const ff = getComputedStyle(n).fontFamily;
          if (!ff) continue;
          const first = ff.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
          const key = first + '|computed';
          if (!first || seen[key]) continue;
          seen[key] = true;
          fonts.push({ family: first, source: 'computed', status: 'used-in-subtree' });
        } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }
    return fonts.slice(0, 40);
  }

  function collectAssets(root) {
    const assets = [];
    const seen = Object.create(null);
    function add(kind, url, note, selector) {
      const u = absUrl(url);
      if (!u || seen[u]) return;
      // skip picker chrome / empty
      if (u.indexOf('__element-picker') !== -1) return;
      seen[u] = true;
      assets.push({ kind: kind, url: u, note: note || '', selector: selector || '' });
    }

    try {
      const imgs = root.querySelectorAll('img');
      for (let i = 0; i < imgs.length && assets.length < 50; i++) {
        const img = imgs[i];
        const sel = shortSelector(img);
        if (img.currentSrc) add('img', img.currentSrc, 'img.currentSrc', sel);
        if (img.src) add('img', img.src, 'img.src', sel);
        // Lazy-load plugins keep a placeholder in src (dummy.png / 1x1 gif)
        // and the real file in a data attribute.
        for (const attr of ['data-lazyload', 'data-src', 'data-lazy-src', 'data-original']) {
          const lazy = img.getAttribute(attr);
          if (lazy) add('img', lazy, 'img ' + attr, sel);
        }
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const parts = srcset.split(',');
          for (const p of parts) {
            const u = p.trim().split(/\\s+/)[0];
            if (u) add('img', u, 'img.srcset', sel);
          }
        }
      }
    } catch (_) { /* ignore */ }

    try {
      const sources = root.querySelectorAll('source, video, audio');
      for (let i = 0; i < sources.length && assets.length < 50; i++) {
        const el = sources[i];
        const sel = shortSelector(el);
        const src = el.currentSrc || el.src || el.getAttribute('src');
        if (src) add('video', src, el.tagName.toLowerCase() + '.src', sel);
        const poster = el.getAttribute && el.getAttribute('poster');
        if (poster) add('img', poster, 'video.poster', sel);
        const srcset = el.getAttribute && el.getAttribute('srcset');
        if (srcset) {
          srcset.split(',').forEach((p) => {
            const u = p.trim().split(/\\s+/)[0];
            if (u) add('source', u, 'srcset', sel);
          });
        }
      }
    } catch (_) { /* ignore */ }

    try {
      const useEls = root.querySelectorAll('use, image');
      for (let i = 0; i < useEls.length && assets.length < 50; i++) {
        const el = useEls[i];
        const href = el.getAttribute('href') || el.getAttribute('xlink:href') || el.href && el.href.baseVal;
        if (href) add('svg', href, 'svg ref', shortSelector(el));
      }
    } catch (_) { /* ignore */ }

    // background-image / mask / list-style from computed styles
    try {
      const nodes = [root].concat(Array.from(root.querySelectorAll('*')).slice(0, 100));
      for (const n of nodes) {
        if (assets.length >= 50) break;
        if (isOurUi(n)) continue;
        try {
          const cs = getComputedStyle(n);
          for (const prop of ['background-image', 'mask-image', 'list-style-image', 'border-image-source']) {
            const urls = extractUrlsFromCssValue(cs.getPropertyValue(prop));
            for (const u of urls) add('background', u, prop, shortSelector(n));
          }
        } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }

    // @font-face urls
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        if (sheetSourceLabel(sheet) === null) continue;
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        walkStyleRulesForSpecial(rules, (rule) => {
          if (!(rule.type === 5 || (rule.cssText && /^@font-face/i.test(rule.cssText)))) return;
          const base = ruleBaseUrl(rule, sheet);
          const urls = extractUrlsFromCssValue(rule.cssText || '');
          for (const u of urls) add('font', absUrl(u, base), '@font-face', '');
        });
      }
    } catch (_) { /* ignore */ }

    // head icons / preload fonts
    try {
      const links = document.querySelectorAll('link[href]');
      for (let i = 0; i < links.length && assets.length < 50; i++) {
        const l = links[i];
        const rel = (l.rel || '').toLowerCase();
        const href = l.href || l.getAttribute('href');
        if (!href) continue;
        if (rel.indexOf('icon') !== -1) add('icon', href, 'link ' + rel, 'link');
        if (rel === 'preload' && ((l.as || '') === 'font' || (l.as || '') === 'image')) {
          add(l.as === 'font' ? 'font' : 'img', href, 'link preload', 'link');
        }
        if (rel === 'stylesheet' && /fonts?\\./i.test(href)) add('font', href, 'font stylesheet', 'link');
      }
    } catch (_) { /* ignore */ }

    return assets;
  }

  function collectHeadLinks() {
    const out = [];
    try {
      const links = document.querySelectorAll('link[href]');
      for (let i = 0; i < links.length && out.length < 30; i++) {
        const l = links[i];
        const rel = (l.rel || '').toLowerCase();
        if (!rel) continue;
        if (
          rel.indexOf('icon') !== -1 ||
          rel === 'preload' ||
          rel === 'stylesheet' ||
          rel === 'preconnect' ||
          rel === 'font'
        ) {
          out.push({
            rel: rel,
            href: l.href || l.getAttribute('href') || '',
            as: l.as || undefined,
            type: l.type || undefined
          });
        }
      }
    } catch (_) { /* ignore */ }
    return out;
  }

  function collectInlineSvgs(root) {
    const out = [];
    try {
      const svgs = root.querySelectorAll('svg');
      for (let i = 0; i < svgs.length && out.length < 12; i++) {
        try {
          let html = svgs[i].outerHTML || '';
          if (html.length > 120000) html = html.slice(0, 120000) + '<!-- truncated -->';
          out.push(html);
        } catch (_) { /* ignore */ }
      }
      // If root itself is svg
      if ((root.tagName || '').toLowerCase() === 'svg' && out.length === 0) {
        try { out.push(root.outerHTML || ''); } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }
    return out;
  }

  function collectCanvasDataUrls(root) {
    const out = [];
    try {
      const list = [];
      if ((root.tagName || '').toLowerCase() === 'canvas') list.push(root);
      const found = root.querySelectorAll ? root.querySelectorAll('canvas') : [];
      for (let i = 0; i < found.length; i++) list.push(found[i]);
      for (let i = 0; i < list.length && out.length < 6; i++) {
        const c = list[i];
        try {
          const dataUrl = c.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 32 && dataUrl.length < 3500000) {
            out.push({
              selector: shortSelector(c),
              dataUrl: dataUrl,
              width: c.width | 0,
              height: c.height | 0
            });
          }
        } catch (_) {
          // tainted canvas
        }
      }
    } catch (_) { /* ignore */ }
    return out;
  }

  function collectDeepCssText(root, ancestors) {
    const sections = [];
    sections.push(collectCssText(root));

    // Broader descendant rules (bounded BFS)
    try {
      const kids = Array.from(root.querySelectorAll('*')).slice(0, 40);
      const seen = Object.create(null);
      const blocks = [];
      let count = 0;
      for (const kid of kids) {
        if (isOurUi(kid)) continue;
        const rules = collectMatchedRulesForElement(kid, 8);
        const unique = [];
        for (const r of rules) {
          if (seen[r]) continue;
          seen[r] = true;
          unique.push(r);
          count++;
          if (count >= 80) break;
        }
        if (unique.length) {
          blocks.push('/* --- descendant: ' + shortSelector(kid) + ' --- */\\n' + unique.join('\\n\\n'));
        }
        if (count >= 80) break;
      }
      if (blocks.length) {
        sections.push('/* === Matched rules (descendants) === */');
        sections.push(blocks.join('\\n\\n'));
      }
    } catch (_) { /* ignore */ }

    // Ancestor matched rules
    try {
      const ablocks = [];
      for (const a of ancestors) {
        if (!a.node) continue;
        const rules = collectMatchedRulesForElement(a.node, 12);
        if (rules.length) {
          ablocks.push('/* --- ancestor: ' + a.selector + ' --- */\\n' + rules.join('\\n\\n'));
        }
      }
      if (ablocks.length) {
        sections.push('/* === Matched rules (ancestors) === */');
        sections.push(ablocks.join('\\n\\n'));
      }
    } catch (_) { /* ignore */ }

    return sections.join('\\n\\n');
  }

  function buildStyleTree(root) {
    const tree = [];
    const MAX = 50;
    function walk(node, depth) {
      if (!node || tree.length >= MAX || depth > 6) return;
      if (isOurUi(node)) return;
      tree.push({
        selector: shortSelector(node),
        htmlPath: htmlPath(node),
        tagName: (node.tagName || '').toLowerCase(),
        resolvedStyles: collectResolved(node),
        matchedCss: collectMatchedRulesForElement(node, 6).join('\\n\\n'),
        depth: depth
      });
      const children = node.children ? Array.from(node.children) : [];
      // Prefer first N meaningful children
      const maxKids = depth === 0 ? 12 : 6;
      for (let i = 0; i < Math.min(children.length, maxKids); i++) {
        walk(children[i], depth + 1);
        if (tree.length >= MAX) break;
      }
    }
    walk(root, 0);
    return tree;
  }

  function buildAncestors(el) {
    const out = [];
    let cur = el.parentElement;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 5) {
      if (cur === document.documentElement || cur === document.body) {
        // still include body once for layout
        if (cur === document.body || depth === 0) {
          /* include */
        } else {
          break;
        }
      }
      const r = cur.getBoundingClientRect();
      out.push({
        node: cur,
        selector: shortSelector(cur),
        tagName: (cur.tagName || '').toLowerCase(),
        htmlPath: htmlPath(cur),
        resolvedStyles: collectResolved(cur),
        matchedCss: collectMatchedRulesForElement(cur, 12).join('\\n\\n'),
        dimensions: {
          top: Math.round(r.top),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height)
        }
      });
      cur = cur.parentElement;
      depth++;
    }
    return out;
  }

  function buildClonePayload(el) {
    const base = buildPayload(el);
    // Full-site captures need room for the whole document markup
    const MAX_HTML = STATE.cloneFullSite ? 3000000 : 900000;
    let subtreeHTML = '';
    let subtreeTruncated = false;
    try {
      subtreeHTML = el.outerHTML || '';
      if (subtreeHTML.length > MAX_HTML) {
        subtreeHTML = subtreeHTML.slice(0, MAX_HTML);
        subtreeTruncated = true;
      }
    } catch (_) {
      subtreeHTML = base.outerHTML || '';
    }

    let innerText = '';
    try { innerText = (el.innerText || '').slice(0, 4000); } catch (_) { innerText = base.innerText || ''; }

    const ancestorsRaw = buildAncestors(el);
    const ancestors = ancestorsRaw.map((a) => ({
      selector: a.selector,
      tagName: a.tagName,
      htmlPath: a.htmlPath,
      resolvedStyles: a.resolvedStyles,
      matchedCss: a.matchedCss,
      dimensions: a.dimensions
    }));

    let parentDimensions = null;
    if (el.parentElement) {
      const pr = el.parentElement.getBoundingClientRect();
      parentDimensions = {
        top: Math.round(pr.top),
        left: Math.round(pr.left),
        width: Math.round(pr.width),
        height: Math.round(pr.height)
      };
    }

    const pageMetrics = {
      scrollWidth: Math.max(
        document.documentElement.scrollWidth || 0,
        document.body ? document.body.scrollWidth : 0,
        1
      ),
      scrollHeight: Math.max(
        document.documentElement.scrollHeight || 0,
        document.body ? document.body.scrollHeight : 0,
        1
      ),
      viewportWidth: window.innerWidth || document.documentElement.clientWidth || 0,
      viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0
    };

    const deepCssText = collectDeepCssText(el, ancestorsRaw);
    const motionStyles = collectMotion(el);
    // collect animation names from root + children
    const animNames = [];
    try {
      const nodes = [el].concat(Array.from(el.querySelectorAll('*')).slice(0, 40));
      for (const n of nodes) {
        try {
          const name = getComputedStyle(n).animationName;
          if (name && name !== 'none') {
            name.split(',').forEach((x) => {
              const t = x.trim();
              if (t && t !== 'none') animNames.push(t);
            });
          }
        } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }

    const keyframesCss = collectKeyframesCss(animNames);
    const fontFaceCss = collectFontFaceCss();
    const fonts = collectFontsUsed(el);
    const assets = collectAssets(el);
    const styleTree = buildStyleTree(el);
    const inlineSvgs = collectInlineSvgs(el);
    const canvasDataUrls = collectCanvasDataUrls(el);
    const deepCssVariables = collectDeepCssVariables(el, ancestorsRaw);
    const headLinks = collectHeadLinks();

    const pe = {
      '::before': collectPseudoElement(el, '::before'),
      '::after': collectPseudoElement(el, '::after')
    };

    return Object.assign({}, base, {
      captureMode: 'clone',
      fullSiteCapture: !!STATE.cloneFullSite,
      innerText: innerText,
      outerHTML: subtreeHTML.length > 100000 ? subtreeHTML.slice(0, 100000) : subtreeHTML,
      subtreeHTML: subtreeHTML,
      subtreeTruncated: subtreeTruncated,
      ancestors: ancestors,
      parentDimensions: parentDimensions,
      pageMetrics: pageMetrics,
      deepCssText: deepCssText,
      keyframesCss: keyframesCss,
      fontFaceCss: fontFaceCss,
      motionStyles: motionStyles,
      fonts: fonts,
      assets: assets,
      styleTree: styleTree,
      inlineSvgs: inlineSvgs,
      canvasDataUrls: canvasDataUrls,
      pseudoElements: pe,
      deepCssVariables: deepCssVariables,
      headLinks: headLinks,
      cssText: deepCssText,
      cssVariables: deepCssVariables
    });
  }

  let lastEl = null;

  function isPickingActive() {
    return !!(STATE.selectMode || STATE.cloneMode);
  }

  function applyModeChrome() {
    const on = isPickingActive();
    document.documentElement.classList.toggle('__element-picker-on', on);
    document.documentElement.classList.toggle('__element-picker-clone', !!STATE.cloneMode);
    if (!on) {
      lastEl = null;
      paintHighlight(null);
    }
  }

  /** elementFromPoint that descends into open shadow roots (web components). */
  function deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }

  function onMove(e) {
    if (!isPickingActive() || STATE.capturing) return;
    const el = deepElementFromPoint(e.clientX, e.clientY);
    if (!el || isOurUi(el)) {
      lastEl = null;
      paintHighlight(null);
      return;
    }
    lastEl = el;
    paintHighlight(el);
  }

  function onClick(e) {
    if (!isPickingActive()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const el = deepElementFromPoint(e.clientX, e.clientY);
    if (!el || isOurUi(el)) return;
    lastEl = el;
    // Full-site clone: any click captures the whole document instead
    const targetEl = (STATE.cloneMode && STATE.cloneFullSite)
      ? (document.documentElement || el)
      : el;
    // Drop marks from previous picks BEFORE serializing HTML so the attribute
    // never leaks into outerHTML/subtreeHTML of the new payload.
    clearPickedMarks();
    const payload = withCleanPage(() =>
      STATE.cloneMode ? buildClonePayload(targetEl) : buildPayload(el)
    );
    // Mark AFTER payload serialization — screenshots locate this exact element.
    markPicked(targetEl);
    if (typeof window.__elementPickerOnPick === 'function') {
      window.__elementPickerOnPick(payload);
    }
  }

  function onKey(e) {
    if (e.key === 'Escape' && isPickingActive()) {
      setSelectMode(false);
      setCloneMode(false);
      if (typeof window.__elementPickerOnModeChange === 'function') {
        window.__elementPickerOnModeChange(false);
      }
      if (typeof window.__elementPickerOnCloneModeChange === 'function') {
        window.__elementPickerOnCloneModeChange(false);
      }
    }
  }

  function setSelectMode(on) {
    STATE.selectMode = !!on;
    if (STATE.selectMode) STATE.cloneMode = false;
    applyModeChrome();
    return STATE.selectMode;
  }

  function setCloneMode(on) {
    STATE.cloneMode = !!on;
    if (STATE.cloneMode) STATE.selectMode = false;
    applyModeChrome();
    return STATE.cloneMode;
  }

  function onScroll() {
    if (STATE.capturing) return;
    if (isPickingActive() && lastEl) paintHighlight(lastEl);
  }
  function onResize() {
    if (STATE.capturing) return;
    if (isPickingActive() && lastEl) paintHighlight(lastEl);
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize, true);
  window.__elementPickerHandlers = { onMove, onClick, onKey, onScroll, onResize };

  window.__elementPickerSetMode = setSelectMode;
  window.__elementPickerGetMode = () => STATE.selectMode;
  window.__elementPickerSetCloneMode = setCloneMode;
  window.__elementPickerGetCloneMode = () => STATE.cloneMode;
  bindCaptureApis();
  // Prefer full restore with lastEl when this install owns the listeners
  window.__elementPickerRestoreAfterCapture = () => {
    STATE.capturing = false;
    clearPickedMarks();
    if (isPickingActive()) {
      applyModeChrome();
      if (lastEl && document.contains(lastEl)) {
        paintHighlight(lastEl);
      }
    }
    return isPickingActive();
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

/** Evaluate helper: push clone options (full-site capture) into the page. */
export function getSetCloneOptionsSource(opts: { fullSite: boolean }): string {
  return `(() => {
    if (typeof window.__elementPickerSetCloneOptions === 'function') {
      return window.__elementPickerSetCloneOptions({ fullSite: ${opts.fullSite ? "true" : "false"} });
    }
    return false;
  })()`;
}

/** Evaluate helper: set clone mode true/false. */
export function getSetCloneModeSource(on: boolean): string {
  return `(() => {
    if (typeof window.__elementPickerSetCloneMode === 'function') {
      return window.__elementPickerSetCloneMode(${on ? "true" : "false"});
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
    const st = window.__elementPickerState;
    if (st) st.capturing = true;
    const box = document.getElementById('__element-picker-highlight');
    const label = document.getElementById('__element-picker-label');
    if (box) box.style.display = 'none';
    if (label) label.style.display = 'none';
    document.documentElement.classList.remove('__element-picker-on');
    document.documentElement.classList.remove('__element-picker-clone');
    return true;
  })()`;
}

/** Restore select-mode visuals after screenshot. */
export function getRestoreAfterCaptureSource(): string {
  return `(() => {
    if (typeof window.__elementPickerRestoreAfterCapture === 'function') {
      return window.__elementPickerRestoreAfterCapture();
    }
    const st = window.__elementPickerState;
    if (st) st.capturing = false;
    try {
      const marked = document.querySelectorAll('[data-davinchi-picked]');
      for (let i = 0; i < marked.length; i++) marked[i].removeAttribute('data-davinchi-picked');
    } catch (_) { /* ignore */ }
    return false;
  })()`;
}
