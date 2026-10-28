import { P, type Part } from './xml';

export interface Placeholder {
  type: string;
  idx: string | null;
}

export function placeholderOf(sp: Element): Placeholder | undefined {
  const ph = sp.getElementsByTagNameNS(P, 'ph')[0];
  if (!ph) return undefined;
  return { type: ph.getAttribute('type') ?? 'body', idx: ph.getAttribute('idx') };
}

export const isTitle = (type: string | undefined) => type === 'title' || type === 'ctrTitle';

const FURNITURE = new Set(['dt', 'ftr', 'sldNum']);

export function findPlaceholder(part: Part | undefined, type: string, idx: string | null) {
  if (!part) return undefined;
  const withPh = Array.from(part.xml.getElementsByTagNameNS(P, 'sp'))
    .map((sp) => ({ sp, ph: placeholderOf(sp) }))
    .filter((s): s is { sp: Element; ph: Placeholder } => !!s.ph);
  const sameKind = (t: string) => (isTitle(type) ? isTitle(t) : !isTitle(t));
  return (
    (idx ? withPh.find((s) => s.ph.idx === idx) : undefined) ??
    withPh.find((s) => s.ph.type === type) ??
    withPh.find((s) => sameKind(s.ph.type) && !FURNITURE.has(s.ph.type))
  )?.sp;
}

export function inheritedChain(
  ph: Placeholder | undefined,
  layout: Part | undefined,
  master: Part | undefined,
): Element[] {
  if (!ph) return [];
  return [findPlaceholder(layout, ph.type, ph.idx), findPlaceholder(master, ph.type, null)].filter(
    (e): e is Element => !!e,
  );
}
