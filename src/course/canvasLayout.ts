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

export const MENU_CORNER: Record<Layout, { w: number; h: number }> = {
  desktop: { w: 6, h: 10 },
  phone: { w: 10, h: 6 },
};

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
  audio: { desktop: [10, 85, 40, 10], phone: [5, 88, 90, 8] },
  animation: { desktop: [35, 20, 30, 50], phone: [15, 20, 70, 35] },
  scroll: { desktop: [10, 20, 50, 60], phone: [5, 15, 90, 50] },
  popup: { desktop: [70, 82, 22, 10], phone: [25, 88, 50, 7] },
  accordion: { desktop: [15, 15, 70, 70], phone: [5, 10, 90, 70] },
  tabs: { desktop: [15, 15, 70, 70], phone: [5, 10, 90, 70] },
  flip: { desktop: [10, 15, 80, 70], phone: [5, 10, 90, 75] },
  hotspots: { desktop: [15, 10, 70, 80], phone: [5, 15, 90, 50] },
  pathway: { desktop: [20, 20, 60, 60], phone: [5, 15, 90, 60] },
  drag: { desktop: [10, 10, 80, 80], phone: [5, 5, 90, 85] },
  match: { desktop: [15, 10, 70, 80], phone: [5, 5, 90, 85] },
  blank: { desktop: [15, 20, 70, 50], phone: [5, 15, 90, 50] },
  slider: { desktop: [15, 25, 70, 45], phone: [5, 20, 90, 45] },
  written: { desktop: [15, 20, 70, 50], phone: [5, 15, 90, 50] },
  likert: { desktop: [10, 10, 80, 80], phone: [5, 5, 90, 85] },
  results: { desktop: [20, 10, 60, 80], phone: [5, 5, 90, 85] },
};

export function newFrame(type: BlockType, layout: Layout): Frame {
  const [x, y, w, h] = DEFAULT_FRAMES[type][layout];
  return { x, y, w, h, r: 0 };
}
