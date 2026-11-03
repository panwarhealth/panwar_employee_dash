import { isHiddenPopup, type Block, type CourseDoc, type Page } from '@/course/doc';
import { bounds, centreInside, round1, type Box } from '@/course/geometry';
import { DESIGN, grows, isDecor, isHolder } from './blockKinds';
import { measureHeights } from './pageFit';

const EDGE_PX = 32;
const GAP = 1.5;
const PASSES = 6;

const at = (b: Block) => b.frames!.desktop!;

const placed = (page: Page) =>
  page.blocks.filter((b) => b.frames?.desktop && !isHiddenPopup(b) && !isDecor(b));

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function safeArea(page: Page): Box {
  const card = page.blocks
    .filter(isDecor)
    .map(at)
    .filter((f) => f.w < 100 || f.h < 100)
    .sort((a, b) => a.w * a.h - b.w * b.h)[0];
  const edge = card ?? { x: 0, y: 0, w: 100, h: 100 };
  const mx = (EDGE_PX / DESIGN.w) * 100;
  const my = (EDGE_PX / DESIGN.h) * 100;
  return { x: edge.x + mx, y: edge.y + my, w: edge.w - 2 * mx, h: edge.h - 2 * my };
}

export function insetDesktop(page: Page) {
  const blocks = placed(page);
  if (!blocks.length) return;
  const box = bounds(blocks.map(at));
  const safe = safeArea(page);
  const k = Math.min(1, safe.w / box.w, safe.h / box.h);
  const x = clamp(box.x + (box.w * (1 - k)) / 2, safe.x, safe.x + safe.w - box.w * k);
  const y = clamp(box.y + (box.h * (1 - k)) / 2, safe.y, safe.y + safe.h - box.h * k);
  if (k === 1 && Math.abs(x - box.x) < 0.05 && Math.abs(y - box.y) < 0.05) return;
  for (const b of blocks) {
    const f = at(b);
    b.frames!.desktop = {
      ...f,
      x: round1(x + (f.x - box.x) * k),
      y: round1(y + (f.y - box.y) * k),
      w: round1(f.w * k),
      h: round1(f.h * k),
      ...(k < 1 ? { s: Math.round((f.s ?? 1) * k * 100) / 100 } : {}),
    };
  }
}

const below = (a: Box, b: Box) => b.y >= a.y + a.h - 0.5 && a.x < b.x + b.w && b.x < a.x + a.w;

export async function settleDesktop(doc: CourseDoc, page: Page) {
  const natural = await measureHeights(doc, page, 'desktop');
  const blocks = placed(page);
  const was = new Map(blocks.map((b) => [b.id, { ...at(b) }]));
  for (const b of blocks) {
    const h = natural.get(b.id);
    if (grows(b) && h && h > at(b).h + 0.5) at(b).h = round1(h);
  }
  const holders = blocks.filter(isHolder);
  const kids = new Map(
    holders.map((h) => [
      h.id,
      blocks.filter((b) => b !== h && centreInside(was.get(h.id)!, was.get(b.id)!)),
    ]),
  );
  const order = [...blocks].sort((a, b) => was.get(a.id)!.y - was.get(b.id)!.y);
  for (let pass = 0, moved = true; moved && pass < PASSES; pass++) {
    moved = false;
    for (const h of holders) {
      const inside = kids.get(h.id)!;
      if (!inside.length) continue;
      const old = was.get(h.id)!;
      const pad = Math.max(
        0,
        old.y + old.h - Math.max(...inside.map((k) => was.get(k.id)!.y + was.get(k.id)!.h)),
      );
      const bottom = Math.max(...inside.map((k) => at(k).y + at(k).h)) + pad;
      if (bottom > at(h).y + at(h).h + 0.05) {
        at(h).h = round1(bottom - at(h).y);
        moved = true;
      }
    }
    for (const [i, a] of order.entries())
      for (const c of order.slice(i + 1)) {
        if (!below(was.get(a.id)!, was.get(c.id)!) || kids.get(a.id)?.includes(c)) continue;
        const gap = Math.min(GAP, was.get(c.id)!.y - (was.get(a.id)!.y + was.get(a.id)!.h));
        const need = at(a).y + at(a).h + Math.max(0, gap);
        if (at(c).y < need - 0.05) {
          at(c).y = round1(need);
          moved = true;
        }
      }
  }
}

export async function tidyDesktop(doc: CourseDoc, page: Page) {
  await settleDesktop(doc, page);
  insetDesktop(page);
}
