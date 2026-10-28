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

type Item =
  | { kind: 'shape'; shape: DeckShape; block: HeadingBlock | TextBlock }
  | { kind: 'image'; image: DeckImage; block: ImageBlock };

export interface Cluster {
  ids: string[];
  footer: boolean;
  title: boolean;
  text: boolean;
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
  clusters: Cluster[];
  backdrops: string[];
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
    ...(lineHeight ? { lineHeight } : {}),
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

const isBackdrop = (f: Frame) => f.w * f.h > 70 * 70;

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

function clustersOf(items: { id: string; frame: Frame }[]): string[][] {
  const parent = new Map(items.map((i) => [i.id, i.id]));
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (overlap(items[i].frame, items[j].frame)) parent.set(find(items[i].id), find(items[j].id));
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

function readingOrder(groups: { ids: string[]; box: ReturnType<typeof bounds> }[]) {
  const sorted = [...groups].sort((a, b) => a.box.y - b.box.y);
  const rows: (typeof sorted)[] = [];
  for (const g of sorted) {
    const row = rows[rows.length - 1];
    const rowBottom = row ? Math.max(...row.map((r) => r.box.y + r.box.h)) : -Infinity;
    if (row && g.box.y < rowBottom - g.box.h * 0.3) row.push(g);
    else rows.push([g]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.box.x - b.box.x));
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

  const backdrops = items
    .filter((i) => isBackdrop(desktop.get(i.block.id)!))
    .map((i) => i.block.id);
  const content = items.filter((i) => !backdrops.includes(i.block.id));
  const groups = clustersOf(
    content.map((i) => ({ id: i.block.id, frame: desktop.get(i.block.id)! })),
  ).map((ids) => ({ ids, box: bounds(ids.map((id) => desktop.get(id)!)) }));
  const clusters: Cluster[] = readingOrder(groups).map((g) => ({
    ids: content.filter((i) => g.ids.includes(i.block.id)).map((i) => i.block.id),
    footer: g.ids.every((id) => isFooter(desktop.get(id)!)),
    title: g.ids.some((id) => titleIds.has(id)),
    text: g.ids.length === 1 && hasText(content.find((i) => i.block.id === g.ids[0])!.block),
  }));

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
    stackPhone(page, clusters, new Map(), phoneTextScale(page));
  const tables = new Map<string, TableCell[]>();
  for (const item of items)
    if (item.kind === 'shape' && item.shape.cell) {
      const { table, ...cell } = item.shape.cell;
      tables.set(table, [...(tables.get(table) ?? []), { id: item.block.id, ...cell }]);
    }
  return { page, clusters, backdrops, tables: [...tables.values()] };
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

export async function fitPhone(doc: CourseDoc, converted: ConvertedPage): Promise<number> {
  const { page, clusters } = converted;
  const scale = phoneTextScale(page);
  let shrink = 1;
  let used = 1;
  for (let attempt = 0; attempt < 6; attempt++) {
    stackPhone(page, clusters, new Map(), scale, shrink);
    const measured = await measureHeights(doc, page, 'phone');
    const textIds = new Set(clusters.filter((c) => c.text).flatMap((c) => c.ids));
    used = stackPhone(
      page,
      clusters,
      new Map([...measured].filter(([id]) => textIds.has(id))),
      scale,
      shrink,
    );
    if (used <= 1) break;
    shrink *= Math.max(0.6, 0.98 / used);
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
  shrink = 1,
) {
  const byId = new Map(page.blocks.map((b) => [b.id, b]));
  const desk = (id: string) => byId.get(id)!.frames!.desktop!;
  const widthPx = (PHONE.width / 100) * DESIGN.phone.w;
  const placeCluster = (c: Cluster, top: number): number => {
    if (c.text) {
      const b = byId.get(c.ids[0])!;
      const s = round1((textScale.get(b.id) ?? 1) * shrink * 100) / 100;
      const estimate = measured.get(b.id) ?? estimateHeight(b, s, widthPx);
      b.frames!.phone = {
        x: PHONE.left,
        y: round1(top),
        w: PHONE.width,
        h: round1(estimate),
        r: 0,
        s,
      };
      return estimate;
    }
    const box = bounds(c.ids.map(desk));
    const boxPx = { w: (box.w / 100) * DESIGN.desktop.w, h: (box.h / 100) * DESIGN.desktop.h };
    const k = Math.min(widthPx / boxPx.w, 1.4) * shrink;
    const offset = (widthPx - boxPx.w * k) / 2;
    for (const id of c.ids) {
      const f = desk(id);
      const xPx = ((f.x - box.x) / 100) * DESIGN.desktop.w * k + offset;
      const yPx = ((f.y - box.y) / 100) * DESIGN.desktop.h * k;
      byId.get(id)!.frames!.phone = {
        x: round1(PHONE.left + (xPx / DESIGN.phone.w) * 100),
        y: round1(top + (yPx / DESIGN.phone.h) * 100),
        w: round1((((f.w / 100) * DESIGN.desktop.w * k) / DESIGN.phone.w) * 100),
        h: round1((((f.h / 100) * DESIGN.desktop.h * k) / DESIGN.phone.h) * 100),
        r: f.r,
        s: Math.round(k * 100) / 100,
      };
    }
    return ((boxPx.h * k) / DESIGN.phone.h) * 100;
  };

  let top = PHONE.top;
  for (const c of clusters.filter((c) => !c.footer)) {
    top += placeCluster(c, top) + PHONE.gap;
    for (const id of c.ids) byId.get(id)!.frames!.phone!.a = c.title ? 't' : 'c';
  }
  let bottom = PHONE.bottom;
  for (const c of [...clusters.filter((c) => c.footer)].reverse()) {
    const height = placeCluster(c, 0);
    bottom -= height;
    for (const id of c.ids) {
      const f = byId.get(id)!.frames!.phone!;
      f.y = round1(f.y + bottom);
      f.a = 'b';
    }
    bottom -= PHONE.gap;
  }
  return (top - PHONE.gap - PHONE.top + (PHONE.bottom - bottom)) / (PHONE.bottom - PHONE.top);
}

function estimateHeight(b: Block, s: number, widthPx: number): number {
  if (b.type !== 'text' && b.type !== 'heading') return 10;
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
