import { useSyncExternalStore } from 'react';

let peeking: string | null = null;
const listeners = new Set<() => void>();

export function peekReveal(id: string | null) {
  peeking = id;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePeekReveal = () => useSyncExternalStore(subscribe, () => peeking);
