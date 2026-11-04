import { useEffect } from 'react';

const NBSP = '\u00a0';
const ENTITY = '&nbsp;';

export const showNbsp = (text: string) => text.replace(/\u00a0/g, ENTITY);

export const showNbspHtml = (html: string) => html.replace(/\u00a0|&nbsp;/g, '&amp;nbsp;');

const typesText = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && ['text', 'search', ''].includes(el.type)));

const showsCode = (el: HTMLElement) => !!el.closest('[data-nbsp-code]');

function insertNbsp(el: HTMLElement) {
  if (showsCode(el)) document.execCommand('insertText', false, ENTITY);
  else if (el.isContentEditable) document.execCommand('insertHTML', false, ENTITY);
  else document.execCommand('insertText', false, NBSP);
}

function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement : HTMLTextAreaElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(el, value);
}

function replaceTypedEntity(el: HTMLElement) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (!el.value.includes(ENTITY)) return;
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret).split(ENTITY).join(NBSP);
    setFieldValue(el, before + el.value.slice(caret).split(ENTITY).join(NBSP));
    el.setSelectionRange(before.length, before.length);
    return;
  }
  const sel = getSelection();
  const node = sel?.anchorNode;
  if (!sel || !node || node.nodeType !== Node.TEXT_NODE) return;
  const end = sel.anchorOffset;
  if (!(node.textContent ?? '').slice(0, end).endsWith(ENTITY)) return;
  const range = document.createRange();
  range.setStart(node, end - ENTITY.length);
  range.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(range);
  insertNbsp(el);
}

export function useNonBreakingSpace() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || (e.key !== ' ' && e.code !== 'Space')) return;
      if (!typesText(e.target)) return;
      e.preventDefault();
      insertNbsp(e.target);
    };
    const onInput = (e: Event) => {
      const el = e.target;
      if (!typesText(el) || showsCode(el)) return;
      if (el.isContentEditable) setTimeout(() => replaceTypedEntity(el));
      else replaceTypedEntity(el);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('input', onInput, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('input', onInput, true);
    };
  }, []);
}
