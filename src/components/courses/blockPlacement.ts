import { isHiddenPopup, type Block, type Frame, type Layout, type Page } from '@/course/doc';
import { bounds, centreInside, isBackdrop, round1 } from '@/course/geometry';
import { hasText } from '@/course/text';

const areaOf = (b: Block) => (b.frames?.desktop ? b.frames.desktop.w * b.frames.desktop.h : 0);

function enclosingBox(page: Page, held: Block[]): Block | undefined {
  const frame = (b: Block) => b.frames?.desktop;
  const boxes = page.blocks.filter((c) => {
    const f = frame(c);
    if (!f || held.includes(c) || c.type !== 'text' || isBackdrop(f)) return false;
    if ((!c.fill && !c.border) || hasText(c)) return false;
    if (!held.every((b) => frame(b) && centreInside(f, frame(b)!))) return false;
    return page.blocks.every((o) => {
      const of = frame(o);
      if (o === c || held.includes(o) || isHiddenPopup(o) || !of || areaOf(o) >= areaOf(c))
        return true;
      return !centreInside(f, of);
    });
  });
  return boxes.sort((a, b) => areaOf(a) - areaOf(b))[0];
}

function unionFrames(blocks: Block[]): Block['frames'] {
  const frames: NonNullable<Block['frames']> = {};
  const layouts = new Set(blocks.flatMap((b) => Object.keys(b.frames ?? {}) as Layout[]));
  for (const layout of layouts) {
    const all = blocks.map((b) => b.frames?.[layout]).filter((f): f is Frame => !!f);
    const box = bounds(all);
    frames[layout] = {
      x: box.x,
      y: box.y,
      w: round1(box.w),
      h: round1(box.h),
      r: 0,
      ...(all[0].a ? { a: all[0].a } : {}),
    };
  }
  return frames;
}

export function replacement(page: Page, named: Block[]) {
  const held = [...named];
  for (let box = enclosingBox(page, held); box; box = enclosingBox(page, held)) held.push(box);
  const ids = new Set(held.map((b) => b.id));
  return { ids, frames: unionFrames(page.blocks.filter((b) => ids.has(b.id))) };
}
