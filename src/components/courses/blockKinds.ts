import type { Block } from '@/course/doc';
import { isBackdrop } from '@/course/geometry';
import { hasText } from '@/course/text';

export const DESIGN = { w: 960, h: 540 };

export const EDGE_PX = 20;

export const FLOWING = new Set<Block['type']>([
  'check',
  'drag',
  'match',
  'blank',
  'slider',
  'written',
  'likert',
  'results',
  'accordion',
  'tabs',
  'pathway',
]);

export const boxed = (b: Block) => ('fill' in b && !!b.fill) || ('border' in b && !!b.border);

export const isPanel = (b: Block) =>
  b.type === 'shape' || (b.type === 'text' && !hasText(b) && boxed(b));

export function isRound(b: Block): boolean {
  if (b.type === 'shape' && b.shape === 'ellipse') return true;
  const f = b.frames!.desktop!;
  const side = Math.min((f.w / 100) * DESIGN.w, (f.h / 100) * DESIGN.h);
  return 'radius' in b && (b.radius ?? 0) >= side * 0.45;
}

export const isText = (b: Block) => b.type === 'heading' || b.type === 'text';

export const isHolder = (b: Block) =>
  (isPanel(b) || (b.type === 'image' && !!b.stretch)) && !isRound(b);

export const grows = (b: Block) => (isText(b) && hasText(b)) || FLOWING.has(b.type);

export const isDecor = (b: Block) =>
  !!b.frames?.desktop && isBackdrop(b.frames.desktop) && !grows(b) && b.type !== 'button';
