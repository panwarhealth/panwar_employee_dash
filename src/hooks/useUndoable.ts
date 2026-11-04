import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

const LIMIT = 100;
const GROUP_MS = 600;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function useUndoable<T>(initial: T) {
  const [h, setH] = useState<History<T>>({ past: [], present: initial, future: [] });
  const last = useRef(0);

  const set = useCallback((next: SetStateAction<T>) => {
    const now = Date.now();
    const group = now - last.current < GROUP_MS;
    last.current = now;
    setH((s) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next;
      if (Object.is(value, s.present)) return s;
      const past = group && s.past.length ? s.past : [...s.past, s.present].slice(-LIMIT);
      return { past, present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = 0;
    setH((s) =>
      s.past.length
        ? {
            past: s.past.slice(0, -1),
            present: s.past[s.past.length - 1],
            future: [s.present, ...s.future],
          }
        : s,
    );
  }, []);

  const redo = useCallback(() => {
    last.current = 0;
    setH((s) =>
      s.future.length
        ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
        : s,
    );
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) undo();
      else if (k === 'y' || (k === 'z' && e.shiftKey)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [undo, redo]);

  return {
    value: h.present,
    set,
    undo,
    redo,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}
