import { createContext } from 'react';
import type { Block, CourseDoc, Gradient } from '@/course/doc';

const MAX_SWATCHES = 10;

export const CourseColours = createContext<string[]>([]);

const gradientColours = (g: Gradient | undefined) => g?.stops.map((s) => s.colour) ?? [];

function blockColours(b: Block): (string | undefined)[] {
  const own = 'fill' in b ? [b.fill, ...gradientColours(b.gradient)] : [];
  const border = 'border' in b ? [b.border?.colour] : [];
  const text = 'textStyle' in b ? [b.textStyle?.color] : [];
  return [...own, ...border, ...text];
}

export function courseColours(doc: CourseDoc): string[] {
  const counts = new Map<string, number>();
  const all = doc.pages.flatMap((p) => [
    p.background,
    ...gradientColours(p.gradient),
    ...p.blocks.flatMap(blockColours),
  ]);
  for (const c of all)
    if (c && /^#[0-9a-f]{6}$/i.test(c)) {
      const hex = c.toUpperCase();
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  const accent = doc.accent.toUpperCase();
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  return [accent, ...used.filter((c) => c !== accent)].slice(0, MAX_SWATCHES);
}
