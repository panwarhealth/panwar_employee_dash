import type {
  Anchor,
  Block,
  CourseDoc,
  Frame,
  HeadingBlock,
  ImageBlock,
  Layout,
  Page,
  TextBlock,
  TextStyle,
} from '@/course/doc';
import { layoutsFor } from '@/course/canvasLayout';
import { BUILTIN_FONTS } from '@/course/typography';
import { measureHeights } from './pageFit';
import type { Deck, DeckImage, DeckPara, DeckRun, DeckShape, DeckSlide } from './pptx';

const DESIGN = { desktop: { w: 960, h: 540 }, phone: { w: 360, h: 640 } };
const PHONE = { left: 6, width: 88, top: 7, bottom: 97, gap: 2 };
const PHONE_BODY_PX = 15;
const PHONE_TITLE_PX = 24;
const MIN_CARD_SCALE = 0.7;
const MAX_UNIT_HEIGHT = 0.42;
const MIN_PICTURE_SHRINK = 0.4;
const MIN_TEXT_SHRINK = 0.7;

type Item =
  | { kind: 'shape'; shape: DeckShape; block: HeadingBlock | TextBlock }
  | { kind: 'image'; image: DeckImage; block: ImageBlock };

export interface Cluster {
  ids: string[];
  footer: boolean;
  title: boolean;
  flow: boolean;
  row: number;
  container?: string;
  children?: Cluster[];
}

export interface TableCell {
  id: string;
  row: number;
  rowSpan: number;
  gapT: number;
  gapB: number;
}

export interface ConvertedPage {
  page: Page;
  tables: TableCell[][];
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const round1 = (v: number) => Math.round(v * 10) / 10;

function mostCommon<T>(values: { value: T; weight: number }[]): T | undefined {
  const totals = new Map<T, number>();
  for (const v of values) totals.set(v.value, (totals.get(v.value) ?? 0) + v.weight);
  let best: T | undefined;
  let bestWeight = -1;
  for (const [value, weight] of totals)
    if (weight > bestWeight) [best, bestWeight] = [value, weight];
  return best;
}

const textRuns = (paras: DeckPara[]) =>
  paras.flatMap((p) => p.runs).filter((r) => !r.br && r.text.trim());

export function fontIdFor(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return BUILTIN_FONTS.find((f) => f.label.toLowerCase() === name.toLowerCase())?.id;
}

interface Base {
  size: number;
  colour?: string;
  bold: boolean;
  font?: string;
}

function baseOf(paras: DeckPara[]): Base {
  const runs = textRuns(paras);
  const weigh = <T>(get: (r: DeckRun) => T) =>
    runs.map((r) => ({ value: get(r), weight: r.text.length }));
  return {
    size: mostCommon(weigh((r) => r.size)) ?? 18,
    colour: mostCommon(weigh((r) => r.colour)),
    bold: runs.length > 0 && runs.every((r) => r.bold),
    font: mostCommon(weigh((r) => r.font)),
  };
}

function runHtml(r: DeckRun, base: Base): string {
  if (r.br) return '<br>';
  let html = escapeHtml(r.text);
  if (!html) return '';
  const styles: string[] = [];
  if (r.colour && r.colour !== base.colour) styles.push(`color: ${r.colour}`);
  if (!r.baseline && Math.abs(r.size - base.size) > 0.4)
    styles.push(`font-size: ${Math.round((r.size / base.size) * 1000) / 1000}em`);
  if (!!r.bold !== base.bold) styles.push(`font-weight: ${r.bold ? 700 : 400}`);
  const font = fontIdFor(r.font);
  if (r.font !== base.font && font)
    styles.push(`font-family: ${BUILTIN_FONTS.find((f) => f.id === font)!.css}`);
  if (r.highlight) styles.push(`background-color: ${r.highlight}`);
  if (styles.length) html = `<span style="${styles.join('; ')}">${html}</span>`;
  if (r.italic) html = `<em>${html}</em>`;
  if (r.underline) html = `<u>${html}</u>`;
  if (r.strike) html = `<s>${html}</s>`;
  if (r.baseline) html = r.baseline > 0 ? `<sup>${html}</sup>` : `<sub>${html}</sub>`;
  if (r.link && /^https?:\/\//i.test(r.link)) html = `<a href="${escapeHtml(r.link)}">${html}</a>`;
  return html;
}

function parasHtml(paras: DeckPara[], base: Base, align: string): string {
  const out: string[] = [];
  const open: { list: { tag: 'ul' | 'ol'; items: string[] } | null } = { list: null };
  const flush = () => {
    const list = open.list;
    if (list) out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`);
    open.list = null;
  };
  for (const p of paras) {
    const styles: string[] = [];
    if (p.align !== align) styles.push(`text-align: ${p.align}`);
    if (p.lineHeight) styles.push(`line-height: ${p.lineHeight}`);
    if (p.spaceBefore) styles.push(`margin-top: ${round1(p.spaceBefore / base.size)}em`);
    styles.push(`margin-bottom: ${p.spaceAfter ? round1(p.spaceAfter / base.size) : 0}em`);
    const style = ` style="${styles.join('; ')}"`;
    const inner = p.runs.map((r) => runHtml(r, base)).join('') || '<br>';
    if (p.bullet) {
      const tag = p.bullet === 'num' ? 'ol' : 'ul';
      if (open.list?.tag !== tag) {
        flush();
        open.list = { tag, items: [] };
      }
      open.list!.items.push(`<li${style}>${inner}</li>`);
    } else {
      flush();
      out.push(`<p${style}>${inner}</p>`);
    }
  }
  flush();
  return out.join('');
}

function textStyleOf(base: Base, pxPerPt: number, lineHeight: number | undefined): TextStyle {
  return {
    size: round1(base.size * pxPerPt),
    color: base.colour,
    weight: base.bold ? 700 : 400,
    font: fontIdFor(base.font),
    lineHeight: lineHeight ?? 1.2,
  };
}

function shapeBlock(shape: DeckShape, id: string, pxPerPt: number): HeadingBlock | TextBlock {
  const base = baseOf(shape.paras);
  const align = shape.paras.find((p) => textRuns([p]).length)?.align ?? 'left';
  const lineHeight = shape.paras.find((p) => textRuns([p]).length)?.lineHeight;
  const style = {
    fill: shape.fill,
    border: shape.border,
    radius: shape.radius ?? (shape.fill || shape.border ? 0 : undefined),
    corners: shape.corners,
    valign: shape.valign,
  };
  const runs = textRuns(shape.paras);
  const uniform =
    runs.length > 0 &&
    shape.paras.filter((p) => textRuns([p]).length).length === 1 &&
    runs.every(
      (r) =>
        r.colour === base.colour &&
        Math.abs(r.size - base.size) < 0.5 &&
        !!r.bold === base.bold &&
        !r.baseline &&
        !r.italic &&
        !r.underline &&
        !r.link,
    );
  if ((shape.placeholder === 'title' || shape.placeholder === 'ctrTitle') && uniform)
    return {
      id,
      type: 'heading',
      text: runs.map((r) => r.text).join(''),
      level: 1,
      align,
      textStyle: textStyleOf(base, pxPerPt, lineHeight),
      ...style,
    };
  return {
    id,
    type: 'text',
    html: runs.length ? parasHtml(shape.paras, base, align) : '',
    align,
    textStyle: textStyleOf(base, pxPerPt, lineHeight),
    ...style,
  };
}

const hasText = (b: Block) =>
  b.type === 'heading' || (b.type === 'text' && b.html.replace(/<[^>]+>/g, '').trim() !== '');

const contains = (outer: Frame, x: number, y: number) =>
  x >= outer.x && x <= outer.x + outer.w && y >= outer.y && y <= outer.y + outer.h;

const overlap = (a: Frame, b: Frame) =>
  Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
  Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);

const isBackdrop = (f: { w: number; h: number }) => f.w >= 90 && f.h >= 85;

const isFooter = (f: Frame) => f.y >= 85;

function edgeAnchor(f: Frame): Anchor | undefined {
  const top = f.y <= 2;
  const bottom = f.y + f.h >= 98;
  const left = f.x <= 2;
  const right = f.x + f.w >= 98;
  if (!top && !bottom && !left && !right) return undefined;
  const v = top && !bottom ? 't' : bottom && !top ? 'b' : '';
  const h = left && !right ? 'l' : right && !left ? 'r' : '';
  if (!v && !h) return 'c';
  return (v + h || 'c') as Anchor;
}

function desktopAnchor(f: Frame, title: boolean): Anchor {
  if (isBackdrop(f)) return 'c';
  if (title) return f.x <= 2 ? 'tl' : f.x + f.w >= 98 ? 'tr' : 't';
  const edge = edgeAnchor(f);
  if (edge) return edge;
  if (isFooter(f)) {
    const centre = f.x + f.w / 2;
    return centre < 100 / 3 ? 'bl' : centre > 200 / 3 ? 'br' : 'b';
  }
  return 'c';
}

function insetFrame(shape: DeckShape, f: Frame, deck: Deck): Frame {
  if (shape.fill || shape.border) return f;
  const [t, r, b, l] = shape.insets;
  const xPct = (pt: number) => (pt / deck.widthPt) * 100;
  const yPct = (pt: number) => (pt / deck.heightPt) * 100;
  return {
    ...f,
    x: round1(f.x + xPct(l)),
    y: round1(f.y + yPct(t)),
    w: round1(Math.max(1, f.w - xPct(l + r))),
    h: round1(Math.max(1, f.h - yPct(t + b))),
  };
}

function diagramAreas(slide: DeckSlide) {
  const areas = slide.diagrams.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, r: 0 }));
  const merged: Frame[] = [];
  for (const a of areas) {
    const hit = merged.find((m) => overlap(m, a));
    if (hit) Object.assign(hit, bounds([hit, a]));
    else merged.push({ ...a });
  }
  return merged.map((m) => ({ x: round1(m.x), y: round1(m.y), w: round1(m.w), h: round1(m.h) }));
}

const overlapShare = (a: Frame, b: Frame) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(0.01, Math.min(a.w * a.h, b.w * b.h)) : 0;
};

function clustersOf(items: { id: string; frame: Frame }[]): string[][] {
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

function bounds(frames: Frame[]) {
  const x = Math.min(...frames.map((f) => f.x));
  const y = Math.min(...frames.map((f) => f.y));
  return {
    x,
    y,
    w: Math.max(...frames.map((f) => f.x + f.w)) - x,
    h: Math.max(...frames.map((f) => f.y + f.h)) - y,
  };
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

function readingOrder<G extends { box: ReturnType<typeof bounds> }>(groups: G[]) {
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

export function slideToPage(
  deck: Deck,
  slide: DeckSlide,
  mediaUrls: Record<string, string>,
  doc: CourseDoc,
  takenIds: Set<string>,
): ConvertedPage {
  const pxPerPt = DESIGN.desktop.w / deck.widthPt;
  const prefix = `s${slide.number}`;
  const makeId = (kind: string) => {
    let n = 1;
    while (takenIds.has(`${prefix}-${kind}${n}`)) n++;
    const id = `${prefix}-${kind}${n}`;
    takenIds.add(id);
    return id;
  };

  const items: Item[] = [];
  for (const entry of slide.order) {
    if (entry.kind === 'shape') {
      const shape = slide.shapes[entry.index];
      items.push({
        kind: 'shape',
        shape,
        block: shapeBlock(shape, makeId(shape.text.trim() ? 'text' : 'box'), pxPerPt),
      });
    } else {
      const image = slide.images[entry.index];
      const src = mediaUrls[image.media];
      if (!src) continue;
      items.push({
        kind: 'image',
        image,
        block: {
          id: makeId('image'),
          type: 'image',
          src,
          fileName: image.media,
          alt: '',
          size: 'full',
          crop: image.crop,
          radius: image.radius,
          border: image.border,
        },
      });
    }
  }

  for (const area of diagramAreas(slide)) {
    const at = items.findIndex((i) => !isBackdrop(i.kind === 'shape' ? i.shape : i.image));
    items.splice(at < 0 ? items.length : at, 0, {
      kind: 'image',
      image: { media: '', ...area, r: 0, light: false },
      block: {
        id: makeId('diagram'),
        type: 'image',
        src: '',
        fileName: '',
        alt: `Picture needed: export this area of slide ${slide.number} from PowerPoint (a diagram the editor can't draw) and drop it in here.`,
        size: 'full',
      },
    });
  }

  const desktop = new Map<string, Frame>();
  for (const item of items) {
    const src = item.kind === 'shape' ? item.shape : item.image;
    const f: Frame = { x: src.x, y: src.y, w: src.w, h: src.h, r: src.r };
    desktop.set(item.block.id, item.kind === 'shape' ? insetFrame(item.shape, f, deck) : f);
  }

  for (const [i, item] of items.entries()) {
    if (item.kind !== 'image' || !item.image.light) continue;
    const f = desktop.get(item.block.id)!;
    const under = items
      .slice(0, i)
      .reverse()
      .find(
        (o) =>
          o.kind === 'shape' &&
          o.shape.fill &&
          !isBackdrop(desktop.get(o.block.id)!) &&
          contains(desktop.get(o.block.id)!, f.x + f.w / 2, f.y + f.h / 2),
      );
    if (!under) item.block.fill = doc.accent;
  }

  const titleIds = new Set(
    items
      .filter((i) => i.kind === 'shape' && /title/i.test(i.shape.placeholder ?? ''))
      .map((i) => i.block.id),
  );
  const anchors = new Map<string, Anchor>();
  for (const [i, item] of items.entries()) {
    const f = desktop.get(item.block.id)!;
    const host = isBackdrop(f)
      ? undefined
      : items
          .slice(0, i)
          .reverse()
          .find((o) => {
            const of = desktop.get(o.block.id)!;
            return !isBackdrop(of) && contains(of, f.x + f.w / 2, f.y + f.h / 2);
          });
    anchors.set(
      item.block.id,
      host ? anchors.get(host.block.id)! : desktopAnchor(f, titleIds.has(item.block.id)),
    );
  }

  const blocks: Block[] = items.map((item) => {
    const frames: Partial<Record<Layout, Frame>> = {};
    for (const layout of layoutsFor(doc.screens)) {
      const f = desktop.get(item.block.id)!;
      frames[layout] =
        layout === 'desktop' ? { ...f, a: anchors.get(item.block.id) } : { ...f, a: 'c' };
    }
    return { ...item.block, frames } as Block;
  });

  const titleText =
    items.find((i) => titleIds.has(i.block.id) && i.kind === 'shape')?.kind === 'shape'
      ? (items.find((i) => titleIds.has(i.block.id)) as Extract<Item, { kind: 'shape' }>).shape.text
      : slide.shapes.find((s) => s.text.trim() && !s.fromLayout)?.text;

  const page: Page = {
    id: `slide-${slide.number}`,
    title: (titleText ?? `Slide ${slide.number}`).split('\n')[0].slice(0, 80),
    kind: 'canvas',
    blocks,
    triggers: [],
    ...(slide.background && slide.background.toUpperCase() !== '#FFFFFF'
      ? { background: slide.background }
      : {}),
  };
  if (layoutsFor(doc.screens).includes('phone'))
    stackPhone(page, phoneClusters(page), new Map(), phoneTextScale(page));
  const tables = new Map<string, TableCell[]>();
  for (const item of items)
    if (item.kind === 'shape' && item.shape.cell) {
      const { table, ...cell } = item.shape.cell;
      tables.set(table, [...(tables.get(table) ?? []), { id: item.block.id, ...cell }]);
    }
  return { page, tables: [...tables.values()] };
}

export async function fitTables(doc: CourseDoc, converted: ConvertedPage) {
  if (!converted.tables.length) return;
  const measured = await measureHeights(doc, converted.page, 'desktop');
  const byId = new Map(converted.page.blocks.map((b) => [b.id, b]));
  for (const cells of converted.tables) {
    const frame = (c: TableCell) => byId.get(c.id)!.frames!.desktop!;
    const rows = Math.max(...cells.map((c) => c.row + c.rowSpan));
    const pitch = Array.from({ length: rows }, (_, r) => {
      const own = cells.filter((c) => c.row === r && c.rowSpan === 1);
      return Math.max(
        0,
        ...own.map((c) => Math.max(frame(c).h, measured.get(c.id) ?? 0) + c.gapT + c.gapB),
      );
    });
    let top = Math.min(...cells.map((c) => frame(c).y - c.gapT));
    const rowTop: number[] = [];
    for (let r = 0; r < rows; r++) {
      rowTop.push(top);
      top += pitch[r];
    }
    for (const c of cells) {
      const f = frame(c);
      const span = pitch.slice(c.row, c.row + c.rowSpan).reduce((a, b) => a + b, 0);
      f.y = round1(rowTop[c.row] + c.gapT);
      f.h = round1(Math.max(f.h, span - c.gapT - c.gapB));
    }
  }
}

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
  'scroll',
]);

const plainText = (b: Block) =>
  b.type === 'heading'
    ? b.text
    : b.type === 'text'
      ? b.html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ')
      : '';

const placedOnPhone = (b: Block) => !!b.frames?.desktop && !(b.type === 'popup' && !b.showButton);

export function phoneClusters(page: Page): Cluster[] {
  const blocks = page.blocks.filter(placedOnPhone);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const desk = (id: string) => byId.get(id)!.frames!.desktop!;
  const boxed = (b: Block) => 'fill' in b && (!!b.fill || ('border' in b && !!b.border));
  const round = (b: Block) => {
    const f = b.frames!.desktop!;
    const side = Math.min((f.w / 100) * DESIGN.desktop.w, (f.h / 100) * DESIGN.desktop.h);
    return 'radius' in b && (b.radius ?? 0) >= side * 0.45;
  };
  const isTitle = (b: Block) =>
    (b.type === 'heading' || b.type === 'text') &&
    hasText(b) &&
    /^t[lr]?$/.test(b.frames!.desktop!.a ?? '');
  const reflows = (id: string) => {
    const b = byId.get(id)!;
    if (FLOWING.has(b.type)) return true;
    if (!hasText(b)) return false;
    const w = desk(id).w;
    if (!boxed(b)) return w >= 20 || plainText(b).length > 40;
    return !round(b) && w >= 40;
  };
  const inside = (outer: string, id: string) => {
    const f = desk(id);
    return contains(desk(outer), f.x + f.w / 2, f.y + f.h / 2);
  };
  const containerOf = (ids: string[]) =>
    ids.find((id) => {
      const b = byId.get(id)!;
      if (b.type !== 'text' || hasText(b) || round(b) || !boxed(b)) return false;
      const box = desk(id);
      if (box.w < 10 || box.h < 10) return false;
      const others = ids.filter((o) => o !== id);
      const held = others.filter((o) => inside(id, o)).length;
      return held >= 2 && held >= others.length * 0.6;
    });
  const build = (ids: string[]): Cluster[] => {
    const groups = clustersOf(ids.map((id) => ({ id, frame: desk(id) }))).map((g) => ({
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
        footer: held.every((id) => isFooter(desk(id))),
        title: held.some((id) => isTitle(byId.get(id)!)),
        flow: held.length === 1 && reflows(held[0]),
        row: g.row,
        ...(container ? { container, children: build(held.filter((id) => id !== container)) } : {}),
      });
      const rest = ordered.filter((id) => !held.includes(id));
      if (rest.length) out.push(...build(rest).map((c) => ({ ...c, row: -1 - out.length })));
    }
    return out;
  };
  return build(blocks.filter((b) => !isBackdrop(b.frames!.desktop!)).map((b) => b.id));
}

export async function fitPhone(doc: CourseDoc, page: Page): Promise<number> {
  for (const b of page.blocks)
    if (b.frames?.desktop && isBackdrop(b.frames.desktop))
      b.frames.phone = { ...b.frames.desktop, a: 'c' };
  const clusters = phoneClusters(page);
  const scale = phoneTextScale(page);
  const shrink = { text: 1, pictures: 1 };
  let used = 1;
  for (let attempt = 0; attempt < 8; attempt++) {
    stackPhone(page, clusters, new Map(), scale, shrink);
    const measured = await measureHeights(doc, page, 'phone');
    const flowIds = (list: Cluster[]): string[] =>
      list.flatMap((c) => (c.children ? flowIds(c.children) : c.flow ? c.ids : []));
    const textIds = new Set(flowIds(clusters));
    used = stackPhone(
      page,
      clusters,
      new Map([...measured].filter(([id]) => textIds.has(id))),
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

export function phoneTextScale(page: Page): Map<string, number> {
  const texts = page.blocks.filter(
    (b): b is HeadingBlock | TextBlock =>
      (b.type === 'text' || b.type === 'heading') && !!b.textStyle?.size,
  );
  const sizes = texts.map((b) => ({
    value: b.textStyle!.size!,
    weight: b.type === 'heading' ? b.text.length : b.html.replace(/<[^>]+>/g, '').length,
  }));
  const body = mostCommon(sizes) ?? 16;
  const pageScale = Math.min(1, PHONE_BODY_PX / body);
  return new Map(
    texts.map((b) => [
      b.id,
      Math.min(pageScale, b.textStyle!.size! > body ? PHONE_TITLE_PX / b.textStyle!.size! : 1),
    ]),
  );
}

export function stackPhone(
  page: Page,
  clusters: Cluster[],
  measured: Map<string, number>,
  textScale: Map<string, number>,
  shrink = { text: 1, pictures: 1 },
) {
  const byId = new Map(page.blocks.map((b) => [b.id, b]));
  const desk = (id: string) => byId.get(id)!.frames!.desktop!;
  const H = DESIGN.phone.h;
  const gapPx = (PHONE.gap / 100) * H;
  const pad = 10;
  const pxBox = (c: Cluster) => {
    const b = bounds(c.ids.map(desk));
    return { ...b, wPx: (b.w / 100) * DESIGN.desktop.w, hPx: (b.h / 100) * DESIGN.desktop.h };
  };
  const setFrame = (id: string, xPx: number, yPx: number, wPx: number, hPx: number, s: number) => {
    byId.get(id)!.frames!.phone = {
      x: round1((xPx / DESIGN.phone.w) * 100),
      y: round1((yPx / H) * 100),
      w: round1((wPx / DESIGN.phone.w) * 100),
      h: round1((hPx / H) * 100),
      r: desk(id).r,
      s: Math.round(s * 100) / 100,
    };
  };

  const placeFlow = (c: Cluster, left: number, width: number, top: number) => {
    const b = byId.get(c.ids[0])!;
    const s = (textScale.get(b.id) ?? 1) * shrink.text;
    const hPx = ((measured.get(b.id) ?? estimateHeight(b, s, width)) / 100) * H;
    setFrame(b.id, left, top, width, hPx, s);
    byId.get(b.id)!.frames!.phone!.r = 0;
    return hPx;
  };

  const placeScaled = (c: Cluster, left: number, top: number, k: number) => {
    const box = pxBox(c);
    for (const id of c.ids) {
      const f = desk(id);
      setFrame(
        id,
        left + ((f.x - box.x) / 100) * DESIGN.desktop.w * k,
        top + ((f.y - box.y) / 100) * DESIGN.desktop.h * k,
        (f.w / 100) * DESIGN.desktop.w * k,
        (f.h / 100) * DESIGN.desktop.h * k,
        k,
      );
    }
  };

  const placeUnit = (
    unit: Cluster[],
    left: number,
    width: number,
    top: number,
    align: 'left' | 'center' | 'right',
  ) => {
    const boxes = unit.map(pxBox);
    if (unit.length > 1) {
      const all = bounds(unit.flatMap((c) => c.ids.map(desk)));
      const rowW = (all.w / 100) * DESIGN.desktop.w;
      const rowH = (all.h / 100) * DESIGN.desktop.h;
      const kRow = Math.min(1, width / rowW, (MAX_UNIT_HEIGHT * H) / rowH);
      if (kRow >= 0.5) {
        const whole: Cluster = { ...unit[0], ids: unit.flatMap((c) => c.ids) };
        const k = kRow * shrink.pictures;
        placeScaled(whole, left + (width - rowW * k) / 2, top, k);
        return rowH * k;
      }
    }
    const maxW = Math.max(...boxes.map((b) => b.wPx));
    const maxH = Math.max(...boxes.map((b) => b.hPx));
    const cols =
      unit.length === 1
        ? 1
        : Math.max(
            1,
            Math.min(unit.length, Math.floor((width + gapPx) / (maxW * MIN_CARD_SCALE + gapPx))),
          );
    const k =
      Math.min(1, (width - (cols - 1) * gapPx) / (cols * maxW), (MAX_UNIT_HEIGHT * H) / maxH) *
      shrink.pictures;
    const cellW = maxW * k;
    const gridW = cols * cellW + (cols - 1) * gapPx;
    const startX =
      left + (align === 'left' ? 0 : align === 'right' ? width - gridW : (width - gridW) / 2);
    let y = top;
    for (let r = 0; r < unit.length; r += cols) {
      const row = unit.slice(r, r + cols);
      const rowH = Math.max(...row.map((c) => pxBox(c).hPx * k));
      row.forEach((c, i) => {
        const b = pxBox(c);
        placeScaled(
          c,
          startX + i * (cellW + gapPx) + (cellW - b.wPx * k) / 2,
          y + (rowH - b.hPx * k) / 2,
          k,
        );
      });
      y += rowH + gapPx;
    }
    return y - gapPx - top;
  };

  const units = (list: Cluster[]) => {
    const out: Cluster[][] = [];
    for (const c of list) {
      const last = out[out.length - 1];
      const scaled = (x: Cluster) => !x.flow && !x.children;
      if (last && scaled(c) && scaled(last[0]) && last[0].row === c.row) last.push(c);
      else out.push([c]);
    }
    return out;
  };

  const placeAny = (
    unit: Cluster[],
    left: number,
    width: number,
    top: number,
    align: 'left' | 'center' | 'right',
  ): number => {
    const first = unit[0];
    if (first.children) {
      const inner = column(first.children, left + pad, width - 2 * pad, top + pad);
      const hPx = inner + 2 * pad;
      setFrame(first.container!, left, top, width, hPx, 1);
      byId.get(first.container!)!.frames!.phone!.r = 0;
      return hPx;
    }
    if (first.flow) return placeFlow(first, left, width, top);
    return placeUnit(unit, left, width, top, align);
  };

  const column = (list: Cluster[], left: number, width: number, top: number) => {
    let y = top;
    for (const unit of units(list)) y += placeAny(unit, left, width, y, 'center') + gapPx;
    return Math.max(0, y - gapPx - top);
  };

  const alignOf = (unit: Cluster[]): 'left' | 'center' | 'right' => {
    if (unit.length > 1) return 'center';
    const b = pxBox(unit[0]);
    const centre = b.x + b.w / 2;
    return centre < 100 / 3 ? 'left' : centre > 200 / 3 ? 'right' : 'center';
  };

  const left = (PHONE.left / 100) * DESIGN.phone.w;
  const width = (PHONE.width / 100) * DESIGN.phone.w;
  let top = (PHONE.top / 100) * H;
  for (const unit of units(clusters.filter((c) => !c.footer))) {
    top += placeAny(unit, left, width, top, 'center') + gapPx;
    for (const c of unit)
      for (const id of c.ids) byId.get(id)!.frames!.phone!.a = c.title ? 't' : 'c';
  }
  let bottom = (PHONE.bottom / 100) * H;
  for (const unit of units(clusters.filter((c) => c.footer)).reverse()) {
    const height = placeAny(unit, left, width, 0, alignOf(unit));
    bottom -= height;
    for (const c of unit)
      for (const id of c.ids) {
        const f = byId.get(id)!.frames!.phone!;
        f.y = round1(f.y + (bottom / H) * 100);
        f.a = 'b';
      }
    bottom -= gapPx;
  }
  const used = top - gapPx - (PHONE.top / 100) * H + ((PHONE.bottom / 100) * H - bottom);
  return used / (((PHONE.bottom - PHONE.top) / 100) * H);
}

function estimateHeight(b: Block, s: number, widthPx: number): number {
  if (b.type !== 'text' && b.type !== 'heading') return 30;
  const size = (b.textStyle?.size ?? 16) * s;
  const line = size * (b.textStyle?.lineHeight ?? 1.3);
  const perLine = Math.max(1, widthPx / (size * 0.5));
  const paras =
    b.type === 'heading'
      ? [b.text]
      : b.html
          .split(/<\/p>|<\/li>|<br>/)
          .map((p) => p.replace(/<[^>]+>/g, ''))
          .filter((p, i, all) => p || i < all.length - 1);
  const lines = paras.reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0);
  const pad = b.fill || b.border ? 8 : 0;
  return ((lines * line + pad) / DESIGN.phone.h) * 100;
}
