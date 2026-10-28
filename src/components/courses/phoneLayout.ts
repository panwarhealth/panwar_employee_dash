import type { Block, CourseDoc, Frame, HeadingBlock, Page, TextBlock } from '@/course/doc';
import { isHiddenPopup } from '@/course/doc';
import {
  bounds,
  centreInside,
  inFooterBand,
  isBackdrop,
  overlapShare,
  round1,
  type Box,
} from '@/course/geometry';
import { blockText, hasText } from '@/course/text';
import { mostCommon } from './deckHtml';
import { measureHeights } from './pageFit';

const DESKTOP = { w: 960, h: 540 };
const PHONE = { w: 360, h: 640, left: 6, width: 88, top: 7, bottom: 97, gap: 2 };
const PHONE_BODY_PX = 15;
const PHONE_TITLE_PX = 24;
const MIN_CARD_SCALE = 0.7;
const MAX_UNIT_HEIGHT = 0.42;
const MIN_PICTURE_SHRINK = 0.4;
const MIN_TEXT_SHRINK = 0.7;
const CONTAINER_PAD = 10;

const FLOWING = new Set<Block['type']>([
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

export interface Cluster {
  ids: string[];
  footer: boolean;
  title: boolean;
  flow: boolean;
  row: number;
  container?: string;
  children?: Cluster[];
}

interface Shrink {
  text: number;
  pictures: number;
}

type Align = 'left' | 'center' | 'right';

function overlapGroups(items: { id: string; frame: Box }[]): string[][] {
  const parent = new Map(items.map((i) => [i.id, i.id]));
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (overlapShare(items[i].frame, items[j].frame) > 0.1)
        parent.set(find(items[i].id), find(items[j].id));
  const groups = new Map<string, string[]>();
  for (const i of items) groups.set(find(i.id), [...(groups.get(find(i.id)) ?? []), i.id]);
  return [...groups.values()];
}

function bands<G>(list: G[], lo: (g: G) => number, hi: (g: G) => number): G[][] {
  const out: { items: G[]; end: number }[] = [];
  for (const g of [...list].sort((a, b) => lo(a) - lo(b))) {
    const last = out[out.length - 1];
    if (last && lo(g) < last.end - 0.5) {
      last.items.push(g);
      last.end = Math.max(last.end, hi(g));
    } else out.push({ items: [g], end: hi(g) });
  }
  return out.map((b) => b.items);
}

function readingOrder<G extends { box: Box }>(groups: G[]): (G & { row: number })[] {
  const out: (G & { row: number })[] = [];
  let next = 0;
  const cut = (list: G[], row: number) => {
    if (list.length === 1) {
      out.push({ ...list[0], row });
      return;
    }
    const rows = bands(
      list,
      (g) => g.box.y,
      (g) => g.box.y + g.box.h,
    );
    if (rows.length > 1) {
      for (const r of rows) cut(r, next++);
      return;
    }
    const cols = bands(
      list,
      (g) => g.box.x,
      (g) => g.box.x + g.box.w,
    );
    if (cols.length > 1) {
      const shared = next++;
      for (const c of cols) cut(c, c.length === 1 ? shared : next++);
      return;
    }
    for (const g of [...list].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x))
      out.push({ ...g, row: next++ });
  };
  cut(groups, next++);
  return out;
}

const desktopOf = (b: Block) => b.frames!.desktop!;

const boxed = (b: Block) => 'fill' in b && (!!b.fill || ('border' in b && !!b.border));

function isRound(b: Block): boolean {
  const f = desktopOf(b);
  const side = Math.min((f.w / 100) * DESKTOP.w, (f.h / 100) * DESKTOP.h);
  return 'radius' in b && (b.radius ?? 0) >= side * 0.45;
}

const isTitle = (b: Block) =>
  (b.type === 'heading' || b.type === 'text') &&
  hasText(b) &&
  /^t[lr]?$/.test(desktopOf(b).a ?? '');

function reflows(b: Block): boolean {
  if (FLOWING.has(b.type)) return true;
  if (!hasText(b)) return false;
  const w = desktopOf(b).w;
  if (!boxed(b)) return w >= 20 || blockText(b).length > 40;
  return !isRound(b) && w >= 40;
}

export function phoneClusters(page: Page): Cluster[] {
  const blocks = page.blocks.filter((b) => b.frames?.desktop && !isHiddenPopup(b));
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const desk = (id: string) => desktopOf(byId.get(id)!);
  const inside = (outer: string, id: string) => centreInside(desk(outer), desk(id));
  const containerOf = (ids: string[]) =>
    ids.find((id) => {
      const b = byId.get(id)!;
      if (b.type !== 'text' || hasText(b) || isRound(b) || !boxed(b)) return false;
      if (desk(id).w < 10 || desk(id).h < 10) return false;
      const others = ids.filter((o) => o !== id);
      const held = others.filter((o) => inside(id, o)).length;
      return held >= 2 && held >= others.length * 0.6;
    });
  const build = (ids: string[]): Cluster[] => {
    const groups = overlapGroups(ids.map((id) => ({ id, frame: desk(id) }))).map((g) => ({
      ids: g,
      box: bounds(g.map(desk)),
    }));
    const out: Cluster[] = [];
    for (const g of readingOrder(groups)) {
      const ordered = ids.filter((id) => g.ids.includes(id));
      const container = containerOf(ordered);
      const held = container
        ? ordered.filter((id) => id === container || inside(container, id))
        : ordered;
      out.push({
        ids: held,
        footer: held.every((id) => inFooterBand(desk(id))),
        title: held.some((id) => isTitle(byId.get(id)!)),
        flow: held.length === 1 && reflows(byId.get(held[0])!),
        row: g.row,
        ...(container ? { container, children: build(held.filter((id) => id !== container)) } : {}),
      });
      const rest = ordered.filter((id) => !held.includes(id));
      if (rest.length) out.push(...build(rest).map((c) => ({ ...c, row: -1 - out.length })));
    }
    return out;
  };
  return build(blocks.filter((b) => !isBackdrop(desktopOf(b))).map((b) => b.id));
}

export function phoneTextScale(page: Page): Map<string, number> {
  const texts = page.blocks.filter(
    (b): b is HeadingBlock | TextBlock =>
      (b.type === 'text' || b.type === 'heading') && !!b.textStyle?.size,
  );
  const body =
    mostCommon(texts.map((b) => ({ value: b.textStyle!.size!, weight: blockText(b).length }))) ??
    16;
  const pageScale = Math.min(1, PHONE_BODY_PX / body);
  return new Map(
    texts.map((b) => [
      b.id,
      Math.min(pageScale, b.textStyle!.size! > body ? PHONE_TITLE_PX / b.textStyle!.size! : 1),
    ]),
  );
}

function estimateHeight(b: Block, s: number, widthPx: number): number {
  if (b.type !== 'text' && b.type !== 'heading') return 30;
  const size = (b.textStyle?.size ?? 16) * s;
  const perLine = Math.max(1, widthPx / (size * 0.5));
  const lines = blockText(b)
    .split('\n')
    .reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);
  const pad = b.fill || b.border ? 8 : 0;
  return ((lines * size * (b.textStyle?.lineHeight ?? 1.3) + pad) / PHONE.h) * 100;
}

class PhoneStack {
  private readonly byId: Map<string, Block>;
  private readonly gap = (PHONE.gap / 100) * PHONE.h;

  constructor(
    page: Page,
    private readonly measured: Map<string, number>,
    private readonly textScale: Map<string, number>,
    private readonly shrink: Shrink,
  ) {
    this.byId = new Map(page.blocks.map((b) => [b.id, b]));
  }

  private desk(id: string): Frame {
    return desktopOf(this.byId.get(id)!);
  }

  private pxBox(ids: string[]) {
    const b = bounds(ids.map((id) => this.desk(id)));
    return { ...b, wPx: (b.w / 100) * DESKTOP.w, hPx: (b.h / 100) * DESKTOP.h };
  }

  private setFrame(id: string, x: number, y: number, w: number, h: number, s: number, r?: number) {
    this.byId.get(id)!.frames!.phone = {
      x: round1((x / PHONE.w) * 100),
      y: round1((y / PHONE.h) * 100),
      w: round1((w / PHONE.w) * 100),
      h: round1((h / PHONE.h) * 100),
      r: r ?? this.desk(id).r,
      s: Math.round(s * 100) / 100,
    };
  }

  private placeFlow(c: Cluster, left: number, width: number, top: number): number {
    const b = this.byId.get(c.ids[0])!;
    const s = (this.textScale.get(b.id) ?? 1) * this.shrink.text;
    const h = ((this.measured.get(b.id) ?? estimateHeight(b, s, width)) / 100) * PHONE.h;
    this.setFrame(b.id, left, top, width, h, s, 0);
    return h;
  }

  private placeScaled(ids: string[], left: number, top: number, k: number) {
    const box = this.pxBox(ids);
    for (const id of ids) {
      const f = this.desk(id);
      this.setFrame(
        id,
        left + ((f.x - box.x) / 100) * DESKTOP.w * k,
        top + ((f.y - box.y) / 100) * DESKTOP.h * k,
        (f.w / 100) * DESKTOP.w * k,
        (f.h / 100) * DESKTOP.h * k,
        k,
      );
    }
  }

  private placeRow(unit: Cluster[], left: number, width: number, top: number): number | null {
    const row = this.pxBox(unit.flatMap((c) => c.ids));
    const k = Math.min(1, width / row.wPx, (MAX_UNIT_HEIGHT * PHONE.h) / row.hPx);
    if (k < 0.5) return null;
    const scaled = k * this.shrink.pictures;
    this.placeScaled(
      unit.flatMap((c) => c.ids),
      left + (width - row.wPx * scaled) / 2,
      top,
      scaled,
    );
    return row.hPx * scaled;
  }

  private placeGrid(unit: Cluster[], left: number, width: number, top: number, align: Align) {
    const boxes = unit.map((c) => this.pxBox(c.ids));
    const maxW = Math.max(...boxes.map((b) => b.wPx));
    const maxH = Math.max(...boxes.map((b) => b.hPx));
    const fit = Math.floor((width + this.gap) / (maxW * MIN_CARD_SCALE + this.gap));
    const cols = unit.length === 1 ? 1 : Math.max(1, Math.min(unit.length, fit));
    const k =
      Math.min(
        1,
        (width - (cols - 1) * this.gap) / (cols * maxW),
        (MAX_UNIT_HEIGHT * PHONE.h) / maxH,
      ) * this.shrink.pictures;
    const cellW = maxW * k;
    const gridW = cols * cellW + (cols - 1) * this.gap;
    const startX =
      left + (align === 'left' ? 0 : align === 'right' ? width - gridW : (width - gridW) / 2);
    let y = top;
    for (let r = 0; r < unit.length; r += cols) {
      const row = boxes.slice(r, r + cols);
      const rowH = Math.max(...row.map((b) => b.hPx * k));
      row.forEach((b, i) =>
        this.placeScaled(
          unit[r + i].ids,
          startX + i * (cellW + this.gap) + (cellW - b.wPx * k) / 2,
          y + (rowH - b.hPx * k) / 2,
          k,
        ),
      );
      y += rowH + this.gap;
    }
    return y - this.gap - top;
  }

  private placeContainer(c: Cluster, left: number, width: number, top: number): number {
    const inner = this.column(
      c.children!,
      left + CONTAINER_PAD,
      width - 2 * CONTAINER_PAD,
      top + CONTAINER_PAD,
    );
    const h = inner + 2 * CONTAINER_PAD;
    this.setFrame(c.container!, left, top, width, h, 1, 0);
    return h;
  }

  private place(unit: Cluster[], left: number, width: number, top: number, align: Align): number {
    const first = unit[0];
    if (first.children) return this.placeContainer(first, left, width, top);
    if (first.flow) return this.placeFlow(first, left, width, top);
    return (
      (unit.length > 1 ? this.placeRow(unit, left, width, top) : null) ??
      this.placeGrid(unit, left, width, top, align)
    );
  }

  private units(list: Cluster[]): Cluster[][] {
    const scaled = (c: Cluster) => !c.flow && !c.children;
    const out: Cluster[][] = [];
    for (const c of list) {
      const last = out[out.length - 1];
      if (last && scaled(c) && scaled(last[0]) && last[0].row === c.row) last.push(c);
      else out.push([c]);
    }
    return out;
  }

  private column(list: Cluster[], left: number, width: number, top: number): number {
    let y = top;
    for (const unit of this.units(list)) y += this.place(unit, left, width, y, 'center') + this.gap;
    return Math.max(0, y - this.gap - top);
  }

  private alignOf(unit: Cluster[]): Align {
    if (unit.length > 1) return 'center';
    const b = this.pxBox(unit[0].ids);
    const centre = b.x + b.w / 2;
    return centre < 100 / 3 ? 'left' : centre > 200 / 3 ? 'right' : 'center';
  }

  private anchor(unit: Cluster[], a: (c: Cluster) => Frame['a'], dy = 0) {
    for (const c of unit)
      for (const id of c.ids) {
        const f = this.byId.get(id)!.frames!.phone!;
        f.y = round1(f.y + (dy / PHONE.h) * 100);
        f.a = a(c);
      }
  }

  run(clusters: Cluster[]): number {
    const left = (PHONE.left / 100) * PHONE.w;
    const width = (PHONE.width / 100) * PHONE.w;
    const start = (PHONE.top / 100) * PHONE.h;
    const end = (PHONE.bottom / 100) * PHONE.h;
    let top = start;
    for (const unit of this.units(clusters.filter((c) => !c.footer))) {
      top += this.place(unit, left, width, top, 'center') + this.gap;
      this.anchor(unit, (c) => (c.title ? 't' : 'c'));
    }
    let bottom = end;
    for (const unit of this.units(clusters.filter((c) => c.footer)).reverse()) {
      bottom -= this.place(unit, left, width, 0, this.alignOf(unit));
      this.anchor(unit, () => 'b', bottom);
      bottom -= this.gap;
    }
    return (top - this.gap - start + (end - bottom)) / (end - start);
  }
}

export function stackPhone(
  page: Page,
  clusters: Cluster[],
  measured: Map<string, number> = new Map(),
  textScale: Map<string, number> = phoneTextScale(page),
  shrink: Shrink = { text: 1, pictures: 1 },
): number {
  return new PhoneStack(page, measured, textScale, shrink).run(clusters);
}

const flowIds = (list: Cluster[]): string[] =>
  list.flatMap((c) => (c.children ? flowIds(c.children) : c.flow ? c.ids : []));

export async function fitPhone(doc: CourseDoc, page: Page): Promise<number> {
  for (const b of page.blocks)
    if (b.frames?.desktop && isBackdrop(b.frames.desktop))
      b.frames.phone = { ...b.frames.desktop, a: 'c' };
  const clusters = phoneClusters(page);
  const scale = phoneTextScale(page);
  const flowing = new Set(flowIds(clusters));
  const shrink: Shrink = { text: 1, pictures: 1 };
  let used = 1;
  for (let attempt = 0; attempt < 8; attempt++) {
    stackPhone(page, clusters, new Map(), scale, shrink);
    const measured = await measureHeights(doc, page, 'phone');
    used = stackPhone(
      page,
      clusters,
      new Map([...measured].filter(([id]) => flowing.has(id))),
      scale,
      shrink,
    );
    if (used <= 1) break;
    const step = Math.max(0.75, 0.98 / used);
    if (shrink.pictures > MIN_PICTURE_SHRINK)
      shrink.pictures = Math.max(MIN_PICTURE_SHRINK, shrink.pictures * step);
    else if (shrink.text > MIN_TEXT_SHRINK)
      shrink.text = Math.max(MIN_TEXT_SHRINK, shrink.text * step);
    else break;
  }
  return used;
}
