import type { KeyboardEvent } from 'react';

export function typeNonBreakingSpace(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key !== ' ') return false;
  e.preventDefault();
  document.execCommand('insertText', false, '\u00a0');
  return true;
}
