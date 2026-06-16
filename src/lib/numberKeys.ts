import type { KeyboardEvent } from 'react';

export function blockNonNumericKey(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key.length === 1 && !/[\d.]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
}
