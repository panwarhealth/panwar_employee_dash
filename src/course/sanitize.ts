const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'S', 'A', 'UL', 'OL', 'LI', 'SPAN']);
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'NOSCRIPT']);
const RENAME: Record<string, string> = {
  B: 'strong',
  I: 'em',
  DIV: 'p',
  STRIKE: 's',
  FONT: 'span',
};

const COLOR =
  /^([a-z]{3,20}|#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\))$/i;
const DECORATION = /^(none|underline|line-through)( (underline|line-through))?$/;

const STYLES: Record<string, RegExp> = {
  color: COLOR,
  'background-color': COLOR,
  'font-family': /^[\w\s'",-]{1,120}$/,
  'font-size': /^\d{1,3}(\.\d{1,4})?(em|px|rem|%)$/,
  'font-weight': /^(normal|bold|[1-9]00)$/,
  'font-style': /^(normal|italic)$/,
  'text-decoration': DECORATION,
  'text-decoration-line': DECORATION,
  'text-align': /^(left|center|right|justify|start|end)$/,
  'line-height': /^\d{1,2}(\.\d{1,3})?(em)?$/,
  'letter-spacing': /^-?\d{1,2}(\.\d{1,4})?(em|px)$/,
};

function cleanStyle(style: CSSStyleDeclaration): string {
  const out: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i);
    const value = style.getPropertyValue(prop).trim();
    if (STYLES[prop]?.test(value)) out.push(`${prop}: ${value}`);
  }
  return out.join('; ');
}

function clean(node: Node, out: Node, doc: Document) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    const tag = child.tagName;
    if (DROP.has(tag)) return;
    if (!ALLOWED.has(tag) && !RENAME[tag]) {
      clean(child, out, doc);
      return;
    }
    const el = doc.createElement(RENAME[tag] ?? tag.toLowerCase());
    if (tag === 'A') {
      const href = child.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        el.setAttribute('href', href);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    }
    const fontColor = tag === 'FONT' ? child.getAttribute('color') : null;
    const styles = [
      fontColor && COLOR.test(fontColor) ? `color: ${fontColor}` : '',
      cleanStyle(child.style),
    ]
      .filter(Boolean)
      .join('; ');
    if (styles) el.setAttribute('style', styles);
    clean(child, el, doc);
    out.appendChild(el);
  });
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = doc.createElement('div');
  clean(doc.body, out, doc);
  return out.innerHTML;
}
