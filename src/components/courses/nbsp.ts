import { useEffect } from 'react';

const typesText = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && ['text', 'search', ''].includes(el.type)));

export function useNonBreakingSpace() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || (e.key !== ' ' && e.code !== 'Space')) return;
      if (!typesText(e.target)) return;
      e.preventDefault();
      if ((e.target as HTMLElement).isContentEditable)
        document.execCommand('insertHTML', false, '&nbsp;');
      else document.execCommand('insertText', false, '\u00a0');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
