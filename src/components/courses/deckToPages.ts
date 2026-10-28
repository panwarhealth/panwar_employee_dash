import { uid } from '@/course/doc';
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
} from '@/course/doc';
import { layoutsFor } from '@/course/canvasLayout';
import {
  bounds,
  centreInside,
  inFooterBand,
  isBackdrop,
  overlaps,
  round1,
  type Box,
} from '@/course/geometry';
import { fontIdFor, shapeBlock } from './deckHtml';
import { measureHeights } from './pageFit';
import { fitPhone, phoneClusters, stackPhone } from './phoneLayout';
import type { Deck, DeckShape, DeckSlide } from './pptx';

const DESIGN_W = 960;

type Item =
  | { kind: 'shape'; shape: DeckShape; block: HeadingBlock | TextBlock }
  | { kind: 'image'; image: Box & { r: number; light: boolean }; block: ImageBlock };

interface TableCell {
  id: string;
  row: number;
  rowSpan: number;
  gapT: number;
  gapB: number;
}

interface ConvertedPage {
  page: Page;
  tables: TableCell[][];
}

export interface ImportedDeck {
  pages: Page[];
  crowded: Page[];
  missingFonts: string[];
}

function edgeAnchor(f: Box): Anchor | undefined {
  const top = f.y <= 2;
  const bottom = f.y + f.h >= 98;
  const left = f.x <= 2;
  const right = f.x + f.w >= 98;
  if (!top && !bottom && !left && !right) return undefined;
  const v = top && !bottom ? 't' : bottom && !top ? 'b' : '';
  const h = left && !right ? 'l' : right && !left ? 'r' : '';
  return (v + h || 'c') as Anchor;
}

function desktopAnchor(f: Box, title: boolean): Anchor {
  if (isBackdrop(f)) return 'c';
  if (title) return f.x <= 2 ? 'tl' : f.x + f.w >= 98 ? 'tr' : 't';
  const edge = edgeAnchor(f);
  if (edge) return edge;
  if (inFooterBand(f)) {
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

function diagramAreas(slide: DeckSlide): Box[] {
  const merged: Box[] = [];
  for (const d of slide.diagrams) {
    const area = { x: d.x, y: d.y, w: d.w, h: d.h };
    const hit = merged.find((m) => overlaps(m, area));
    if (hit) Object.assign(hit, bounds([hit, area]));
    else merged.push(area);
  }
  return merged.map((m) => ({ x: round1(m.x), y: round1(m.y), w: round1(m.w), h: round1(m.h) }));
}

const isTitleShape = (item: Item) =>
  item.kind === 'shape' && /title/i.test(item.shape.placeholder ?? '');

function idMaker(slide: DeckSlide, taken: Set<string>) {
  const prefix = `s${slide.number}`;
  return (kind: string) => {
    let n = 1;
    while (taken.has(`${prefix}-${kind}${n}`)) n++;
    const id = `${prefix}-${kind}${n}`;
    taken.add(id);
    return id;
  };
}

function slideItems(
  deck: Deck,
  slide: DeckSlide,
  mediaUrls: Record<string, string>,
  makeId: (kind: string) => string,
): Item[] {
  const pxPerPt = DESIGN_W / deck.widthPt;
  const items: Item[] = [];
  for (const entry of slide.order) {
    if (entry.kind === 'shape') {
      const shape = slide.shapes[entry.index];
      const id = makeId(shape.text.trim() ? 'text' : 'box');
      items.push({ kind: 'shape', shape, block: shapeBlock(shape, id, pxPerPt) });
      continue;
    }
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
  for (const area of diagramAreas(slide)) {
    const at = items.findIndex((i) => !isBackdrop(i.kind === 'shape' ? i.shape : i.image));
    items.splice(at < 0 ? items.length : at, 0, {
      kind: 'image',
      image: { ...area, r: 0, light: false },
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
  return items;
}

function desktopFrames(items: Item[], deck: Deck): Map<string, Frame> {
  const frames = new Map<string, Frame>();
  for (const item of items) {
    const { x, y, w, h, r } = item.kind === 'shape' ? item.shape : item.image;
    const frame = { x, y, w, h, r };
    frames.set(item.block.id, item.kind === 'shape' ? insetFrame(item.shape, frame, deck) : frame);
  }
  return frames;
}

function backWhiteArtwork(items: Item[], frames: Map<string, Frame>, accent: string) {
  items.forEach((item, i) => {
    if (item.kind !== 'image' || !item.image.light) return;
    const f = frames.get(item.block.id)!;
    const sitsOnColour = items
      .slice(0, i)
      .some(
        (o) =>
          o.kind === 'shape' &&
          !!o.shape.fill &&
          !isBackdrop(frames.get(o.block.id)!) &&
          centreInside(frames.get(o.block.id)!, f),
      );
    if (!sitsOnColour) item.block.fill = accent;
  });
}

function anchorsFor(items: Item[], frames: Map<string, Frame>): Map<string, Anchor> {
  const anchors = new Map<string, Anchor>();
  items.forEach((item, i) => {
    const f = frames.get(item.block.id)!;
    const host = isBackdrop(f)
      ? undefined
      : items
          .slice(0, i)
          .reverse()
          .find((o) => {
            const of = frames.get(o.block.id)!;
            return !isBackdrop(of) && centreInside(of, f);
          });
    anchors.set(
      item.block.id,
      host ? anchors.get(host.block.id)! : desktopAnchor(f, isTitleShape(item)),
    );
  });
  return anchors;
}

function tablesOf(items: Item[]): TableCell[][] {
  const tables = new Map<string, TableCell[]>();
  for (const item of items)
    if (item.kind === 'shape' && item.shape.cell) {
      const { table, ...cell } = item.shape.cell;
      tables.set(table, [...(tables.get(table) ?? []), { id: item.block.id, ...cell }]);
    }
  return [...tables.values()];
}

function pageTitle(items: Item[], slide: DeckSlide): string {
  const title = items.find(isTitleShape);
  const text =
    title?.kind === 'shape'
      ? title.shape.text
      : slide.shapes.find((s) => s.text.trim() && !s.fromLayout)?.text;
  return (text ?? `Slide ${slide.number}`).split('\n')[0].slice(0, 80);
}

function slideToPage(
  deck: Deck,
  slide: DeckSlide,
  mediaUrls: Record<string, string>,
  doc: CourseDoc,
  taken: Set<string>,
): ConvertedPage {
  const items = slideItems(deck, slide, mediaUrls, idMaker(slide, taken));
  const frames = desktopFrames(items, deck);
  backWhiteArtwork(items, frames, doc.accent);
  const anchors = anchorsFor(items, frames);
  const blocks: Block[] = items.map((item) => {
    const f = frames.get(item.block.id)!;
    const placed: Partial<Record<Layout, Frame>> = {};
    for (const layout of layoutsFor(doc.screens))
      placed[layout] =
        layout === 'desktop' ? { ...f, a: anchors.get(item.block.id) } : { ...f, a: 'c' };
    return { ...item.block, frames: placed } as Block;
  });
  const page: Page = {
    id: `slide-${slide.number}`,
    title: pageTitle(items, slide),
    blocks,
    triggers: [],
    ...(slide.background && slide.background.toUpperCase() !== '#FFFFFF'
      ? { background: slide.background }
      : {}),
  };
  if (layoutsFor(doc.screens).includes('phone')) stackPhone(page, phoneClusters(page));
  return { page, tables: tablesOf(items) };
}

async function fitTables(doc: CourseDoc, converted: ConvertedPage) {
  if (!converted.tables.length) return;
  const measured = await measureHeights(doc, converted.page, 'desktop');
  const byId = new Map(converted.page.blocks.map((b) => [b.id, b]));
  for (const cells of converted.tables) {
    const frame = (c: TableCell) => byId.get(c.id)!.frames!.desktop!;
    const rows = Math.max(...cells.map((c) => c.row + c.rowSpan));
    const pitch = Array.from({ length: rows }, (_, r) =>
      Math.max(
        0,
        ...cells
          .filter((c) => c.row === r && c.rowSpan === 1)
          .map((c) => Math.max(frame(c).h, measured.get(c.id) ?? 0) + c.gapT + c.gapB),
      ),
    );
    const rowTop: number[] = [];
    let top = Math.min(...cells.map((c) => frame(c).y - c.gapT));
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

function missingFonts(deck: Deck): string[] {
  const fonts = deck.slides.flatMap((s) =>
    s.shapes.flatMap((sh) => sh.paras.flatMap((p) => p.runs.map((r) => r.font))),
  );
  return [...new Set(fonts)].filter((f): f is string => !!f && !fontIdFor(f));
}

export async function importDeck(
  deck: Deck,
  mediaUrls: Record<string, string>,
  doc: CourseDoc,
  onStatus: (message: string) => void,
): Promise<ImportedDeck> {
  const taken = new Set(doc.pages.flatMap((p) => p.blocks.map((b) => b.id)));
  const pageIds = new Set(doc.pages.map((p) => p.id));
  const converted = deck.slides
    .filter((slide) => !slide.hidden)
    .map((slide) => slideToPage(deck, slide, mediaUrls, doc, taken));
  for (const c of converted) while (pageIds.has(c.page.id)) c.page.id = `${c.page.id}-new`;
  for (const [i, c] of converted.entries()) {
    onStatus(`Fitting tables (${i + 1} of ${converted.length})`);
    await fitTables(doc, c);
  }
  const crowded: Page[] = [];
  if (layoutsFor(doc.screens).includes('phone'))
    for (const [i, c] of converted.entries()) {
      onStatus(`Fitting the phone layout (${i + 1} of ${converted.length})`);
      if (!(await fitPhone(doc, c.page))) crowded.push(c.page);
    }
  return { pages: converted.map((c) => c.page), crowded, missingFonts: missingFonts(deck) };
}

export const DOES_NOT_FIT_NOTE =
  "This page doesn't fit on a phone screen. Split it across more pages, or put its sections in a tabs block.";

export async function relayoutPhones(doc: CourseDoc): Promise<{ doc: CourseDoc; crowded: Page[] }> {
  const next = structuredClone(doc);
  const crowded: Page[] = [];
  if (!layoutsFor(next.screens).includes('phone')) return { doc: next, crowded };
  for (const page of next.pages) {
    if (await fitPhone(next, page)) continue;
    crowded.push(page);
    if (!page.notes?.some((n) => n.text === DOES_NOT_FIT_NOTE))
      page.notes = [...(page.notes ?? []), { id: uid(), text: DOES_NOT_FIT_NOTE }];
  }
  return { doc: next, crowded };
}
