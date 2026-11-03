import { isHiddenPopup, type Block, type CourseDoc, type Page } from '@/course/doc';
import { bounds, centreInside, overlaps, round1, type Box } from '@/course/geometry';
import { DESIGN, grows, isDecor, isHolder } from './blockKinds';
import { measureHeights } from './pageFit';

const EDGE_PX = 20;
const GAP = 1.5;
const PASSES = 6;
const FOOTER_GAP_PX = 10;
const MIN_CHANGE = 0.01;

const at = (b: Block) => b.frames!.desktop!;

const placed = (page: Page) =>
  page.blocks.filter((b) => b.frames?.desktop && !isHiddenPopup(b) && !isDecor(b));

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function cardOf(page: Page): Box {
  const card = page.blocks
    .filter(isDecor)
    .map(at)
    .filter((f) => f.w < 100 || f.h < 100)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  return card ?? { x: 0, y: 0, w: 100, h: 100 };
}

function safeArea(card: Box): Box {
  const mx = (EDGE_PX / DESIGN.w) * 100;
  const my = (EDGE_PX / DESIGN.h) * 100;
  return { x: card.x + mx, y: card.y + my, w: card.w - 2 * mx, h: card.h - 2 * my };
}

const spansCard = (card: Box, f: Box) => f.x <= card.x + 1 && f.x + f.w >= card.x + card.w - 1;

function reshape(blocks: Block[], from: Box, x: number, y: number, k: number) {
  for (const b of blocks) {
    const f = at(b);
    b.frames!.desktop = {
      ...f,
      x: round1(x + (f.x - from.x) * k),
      y: round1(y + (f.y - from.y) * k),
      w: round1(f.w * k),
      h: round1(f.h * k),
      ...(k < 1 ? { s: Math.round((f.s ?? 1) * k * 100) / 100 } : {}),
    };
  }
}

export function insetDesktop(page: Page) {
  const card = cardOf(page);
  const blocks = placed(page).filter((b) => !spansCard(card, at(b)));
  if (!blocks.length) return;
  const box = bounds(blocks.map(at));
  const safe = safeArea(card);
  const fit = Math.min(1, safe.w / box.w, safe.h / box.h);
  const k = fit > 1 - MIN_CHANGE ? 1 : fit;
  const x = clamp(box.x + (box.w * (1 - k)) / 2, safe.x, safe.x + safe.w - box.w * k);
  const y = clamp(box.y + (box.h * (1 - k)) / 2, safe.y, safe.y + safe.h - box.h * k);
  if (k === 1 && Math.abs(x - box.x) < 0.05 && Math.abs(y - box.y) < 0.05) return;
  reshape(blocks, box, x, y, k);
}

const isContinue = (b: Block) => b.type === 'button' && b.action.kind === 'next';

function cornerBadge(page: Page, blocks: Block[]): Block | undefined {
  const clicked = new Set(
    page.triggers.flatMap((t) => (t.when.kind === 'click' ? [t.when.blockId] : [])),
  );
  return blocks.find((b) => {
    const f = at(b);
    return clicked.has(b.id) && f.w < 8 && f.h < 12 && f.x > 75 && f.y > 70;
  });
}

export function placeFooter(page: Page) {
  const blocks = placed(page);
  const next = blocks.filter(isContinue);
  if (!next.length) return;
  const card = cardOf(page);
  const safe = safeArea(card);
  const badge = cornerBadge(page, blocks);
  const row = badge ? [...next, badge] : next;
  const gx = (FOOTER_GAP_PX / DESIGN.w) * 100;
  const gy = (FOOTER_GAP_PX / DESIGN.h) * 100;
  const rowH = Math.max(...row.map((b) => at(b).h));
  let right = safe.x + safe.w;
  for (const b of [...row].reverse()) {
    const f = at(b);
    b.frames!.desktop = {
      ...f,
      x: round1(right - f.w),
      y: round1(safe.y + safe.h - (rowH + f.h) / 2),
      a: 'br',
    };
    right -= f.w + gx;
  }
  const strip = bounds(row.map(at));
  const keepOut = { x: strip.x - gx, y: strip.y - gy, w: strip.w + 2 * gx, h: 100 };
  const content = blocks.filter((b) => !row.includes(b) && !spansCard(card, at(b)));
  if (!content.some((b) => overlaps(at(b), keepOut))) return;
  const box = bounds(content.map(at));
  const k = (keepOut.y - box.y) / box.h;
  if (k > 1 - MIN_CHANGE || k <= 0) return;
  reshape(content, box, box.x + (box.w * (1 - k)) / 2, box.y, k);
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
  placeFooter(page);
}
