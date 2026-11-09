const BLOCKS = new Set(['P', 'DIV', 'LI', 'UL', 'OL']);

function contentAfter(node: Node, root: Node): boolean {
  for (let n: Node | null = node; n && n !== root; n = n.parentNode) {
    if (n !== node && n instanceof Element && BLOCKS.has(n.tagName)) return false;
    for (let s = n.nextSibling; s; s = s.nextSibling)
      if (s.nodeType === Node.ELEMENT_NODE || s.textContent) return true;
  }
  return false;
}

export function breakLine(e: KeyboardEvent, root: HTMLElement): boolean {
  if (e.key !== 'Enter' || e.shiftKey) return false;
  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;
  const range = sel.getRangeAt(0);
  const at = range.startContainer;
  const el = at instanceof Element ? at : at.parentElement;
  if (!el || !root.contains(el) || el.closest('li')) return false;
  e.preventDefault();
  range.deleteContents();
  const br = document.createElement('br');
  range.insertNode(br);
  if (!contentAfter(br, root)) br.after(document.createElement('br'));
  const caret = document.createRange();
  caret.setStartAfter(br);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  return true;
}
