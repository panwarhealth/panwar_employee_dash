import { useEffect, useState, type CSSProperties } from 'react';
import type { Block, BlockType, Frame, Layout, Page, Screens } from './doc';

export function layoutsFor(screens: Screens): Layout[] {
  if (screens === 'both') return ['desktop', 'phone'];
  return [screens];
}

function autoFrame(page: Page, block: Block, layout: Layout): Frame {
  let y = 5;
  for (const b of page.blocks) {
    const f = { ...newFrame(b.type, layout), y };
    if (b === block) return f;
    y += f.h + 2;
  }
  return newFrame(block.type, layout);
}

export const frameFor = (page: Page, block: Block, layout: Layout): Frame =>
  block.frames?.[layout] ?? autoFrame(page, block, layout);

export const frameStyle = (f: Frame): CSSProperties => ({
  left: `${f.x}%`,
  top: `${f.y}%`,
  width: `${f.w}%`,
  height: `${f.h}%`,
  transform: f.r ? `rotate(${f.r}deg)` : undefined,
});

export function useCanvasLayout(screens: Screens): Layout {
  const query = '(orientation: portrait)';
  const [portrait, setPortrait] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setPortrait(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  if (screens !== 'both') return screens;
  return portrait ? 'phone' : 'desktop';
}

const DEFAULT_FRAMES: Record<BlockType, Record<Layout, [number, number, number, number]>> = {
  heading: { desktop: [10, 8, 80, 12], phone: [6, 5, 88, 8] },
  text: { desktop: [10, 25, 50, 20], phone: [6, 15, 88, 15] },
  image: { desktop: [30, 20, 40, 50], phone: [10, 20, 80, 30] },
  video: { desktop: [20, 15, 60, 60], phone: [5, 20, 90, 30] },
  embed: { desktop: [20, 15, 60, 60], phone: [5, 20, 90, 30] },
  divider: { desktop: [10, 50, 80, 2], phone: [6, 50, 88, 1] },
  button: { desktop: [70, 82, 22, 10], phone: [25, 88, 50, 7] },
  check: { desktop: [15, 12, 70, 76], phone: [5, 10, 90, 70] },
};

export function newFrame(type: BlockType, layout: Layout): Frame {
  const [x, y, w, h] = DEFAULT_FRAMES[type][layout];
  return { x, y, w, h, r: 0 };
}
