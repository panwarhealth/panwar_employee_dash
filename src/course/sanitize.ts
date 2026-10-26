const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'A', 'UL', 'OL', 'LI']);
const RENAME: Record<string, string> = { B: 'strong', I: 'em', DIV: 'p' };

function clean(node: Node, out: Node, doc: Document) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (!(child instanceof Element)) return;
    const tag = child.tagName;
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
