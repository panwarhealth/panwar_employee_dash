import type JSZip from 'jszip';
import { round1 } from '@/course/geometry';
import { isLightArtwork } from './artwork';
import { inheritedChain, placeholderOf } from './placeholders';
import { readText, VALIGN, type TextStyles } from './text';
import { borderOf, colourOf, fillOf } from './theme';
import type {
  DeckArea,
  DeckBorder,
  DeckDrawing,
  DeckImage,
  DeckRun,
  DeckShape,
  DeckSlide,
} from './types';
import { drawingSvg, shapePaths } from './geometry';
import { presetGeometry } from './presets';
import { A, child, EMU_PER_PT, externalLink, num, P, paragraphsText, R, type Part } from './xml';

const DRAWABLE =
  /^(rect|roundRect|round2SameRect|ellipse|flowChartProcess|flowChartAlternateProcess)$/;
const STRAIGHT_LINE = /^(line|straightConnector1)$/;
const USABLE_MEDIA = /\.(png|jpe?g|gif|svg)$/i;
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};
const DESIGN_W = 960;

export interface SlideContext {
  zip: JSZip;
  slideW: number;
  slideH: number;
  styles: TextStyles;
  layout?: Part;
  master?: Part;
  media: Record<string, Blob>;
  light: Record<string, boolean>;
  shapes: DeckShape[];
  images: DeckImage[];
  diagrams: DeckArea[];
  drawings: DeckDrawing[];
  order: DeckSlide['order'];
}

interface Transform {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

type Placed = { x: number; y: number; w: number; h: number; r: number };

export const IDENTITY: Transform = { ox: 0, oy: 0, sx: 1, sy: 1 };

const designHeight = (ctx: SlideContext) => (DESIGN_W * ctx.slideH) / ctx.slideW;
const xPct = (ctx: SlideContext, pt: number) => (pt / (ctx.slideW / EMU_PER_PT)) * 100;
const yPct = (ctx: SlideContext, pt: number) => (pt / (ctx.slideH / EMU_PER_PT)) * 100;

function place(ctx: SlideContext, xfrm: Element | undefined, t: Transform): Placed {
  const off = child(xfrm, A, 'off');
  const ext = child(xfrm, A, 'ext');
  const pct = (v: number, of: number) => round1((v / of) * 100);
  return {
    x: pct(t.ox + num(off, 'x') * t.sx, ctx.slideW),
    y: pct(t.oy + num(off, 'y') * t.sy, ctx.slideH),
    w: pct(num(ext, 'cx') * t.sx, ctx.slideW),
    h: pct(num(ext, 'cy') * t.sy, ctx.slideH),
    r: Math.round(num(xfrm, 'rot') / 60000),
  };
}

function radiusOf(ctx: SlideContext, geom: Element | undefined, at: Placed) {
  const prst = geom?.getAttribute('prst') ?? '';
  const shortSide = Math.min((at.w / 100) * DESIGN_W, (at.h / 100) * designHeight(ctx));
  if (prst === 'ellipse') return Math.round(shortSide / 2);
  if (!/^(roundRect|round2SameRect)$/.test(prst)) return undefined;
  const adj = geom
    ?.getElementsByTagNameNS(A, 'gd')[0]
    ?.getAttribute('fmla')
    ?.match(/val (\d+)/)?.[1];
  return Math.round((Number(adj ?? 16667) / 100000) * shortSide);
}

function addDrawing(ctx: SlideContext, drawing: DeckDrawing) {
  ctx.order.push({ kind: 'drawing', index: ctx.drawings.length });
  ctx.drawings.push(drawing);
}

function drawShape(
  ctx: SlideContext,
  spPr: Element | undefined,
  at: Placed,
  t: Transform,
  fill: string | undefined,
  border: DeckBorder | undefined,
): boolean {
  const custom = child(spPr, A, 'custGeom');
  const preset = child(spPr, A, 'prstGeom');
  const geometry = custom ?? presetGeometry(preset?.getAttribute('prst') ?? '');
  if (!geometry) return false;
  const xfrm = child(spPr, A, 'xfrm');
  const ext = child(xfrm, A, 'ext');
  const size = { w: num(ext, 'cx') * t.sx, h: num(ext, 'cy') * t.sy };
  if (!size.w || !size.h) return false;
  const svg = drawingSvg(
    shapePaths(geometry, custom ? undefined : child(preset, A, 'avLst'), size.w, size.h),
    size,
    {
      fill,
      stroke: border?.colour,
      strokeWidth: (border?.width ?? 0) * EMU_PER_PT,
      flipH: xfrm?.getAttribute('flipH') === '1',
      flipV: xfrm?.getAttribute('flipV') === '1',
    },
  );
  addDrawing(ctx, { ...at, svg });
  return true;
}

function addShape(ctx: SlideContext, shape: DeckShape) {
  ctx.order.push({ kind: 'shape', index: ctx.shapes.length });
  ctx.shapes.push(shape);
}

function addBar(
  ctx: SlideContext,
  at: Placed,
  fill: string,
  radius: number | undefined,
  fromLayout: boolean,
) {
  addShape(ctx, {
    ...at,
    text: '',
    paras: [],
    valign: 'top',
    insets: [0, 0, 0, 0],
    fromLayout: fromLayout || undefined,
    fill,
    radius,
  });
}

function readLine(
  ctx: SlideContext,
  spPr: Element | undefined,
  at: Placed,
  border: DeckBorder,
  fromLayout: boolean,
) {
  const ln = child(spPr, A, 'ln');
  const xfrm = child(spPr, A, 'xfrm');
  const height = designHeight(ctx);
  const px = (pct: number, of: number) => (pct / 100) * of;
  const flipH = xfrm?.getAttribute('flipH') === '1';
  const flipV = xfrm?.getAttribute('flipV') === '1';
  const x0 = px(flipH ? at.x + at.w : at.x, DESIGN_W);
  const x1 = px(flipH ? at.x : at.x + at.w, DESIGN_W);
  const y0 = px(flipV ? at.y + at.h : at.y, height);
  const y1 = px(flipV ? at.y : at.y + at.h, height);
  const thick = border.width * (DESIGN_W / (ctx.slideW / EMU_PER_PT));
  const toFrame = (cx: number, cy: number, w: number, h: number, r: number): Placed => ({
    x: round1(((cx - w / 2) / DESIGN_W) * 100),
    y: round1(((cy - h / 2) / height) * 100),
    w: round1((w / DESIGN_W) * 100),
    h: round1((h / height) * 100),
    r,
  });
  const angle = Math.round((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI);
  addBar(
    ctx,
    toFrame((x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0), thick, angle),
    border.colour,
    ln?.getAttribute('cap') === 'rnd' ? Math.round(thick / 2) : undefined,
    fromLayout,
  );
  for (const end of [
    { el: child(ln, A, 'headEnd'), x: x0, y: y0 },
    { el: child(ln, A, 'tailEnd'), x: x1, y: y1 },
  ]) {
    const type = end.el?.getAttribute('type');
    if (!type || type === 'none') continue;
    if (type === 'oval')
      addBar(
        ctx,
        toFrame(end.x, end.y, thick * 3, thick * 3, 0),
        border.colour,
        Math.round(thick * 1.5),
        fromLayout,
      );
    else
      addDrawing(
        ctx,
        arrowHead(
          toFrame,
          end,
          thick,
          border.colour,
          end.x === x0 ? { x: x1, y: y1 } : { x: x0, y: y0 },
        ),
      );
  }
}

function arrowHead(
  toFrame: (cx: number, cy: number, w: number, h: number, r: number) => Placed,
  tip: { x: number; y: number },
  thick: number,
  colour: string,
  from: { x: number; y: number },
): DeckDrawing {
  const size = thick * 4;
  const angle = Math.round((Math.atan2(tip.y - from.y, tip.x - from.x) * 180) / Math.PI);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" preserveAspectRatio="none"><path d="M10 5 L0 0 L0 10 Z" fill="${colour}"/></svg>`;
  const back = {
    x: tip.x - (Math.cos((angle * Math.PI) / 180) * size) / 2,
    y: tip.y - (Math.sin((angle * Math.PI) / 180) * size) / 2,
  };
  return { ...toFrame(back.x, back.y, size, size, angle), svg };
}

function readShape(ctx: SlideContext, el: Element, t: Transform, owner: Part, fromLayout: boolean) {
  const ph = placeholderOf(el);
  if (fromLayout && ph) return;
  const phChain = fromLayout ? [] : inheritedChain(ph, ctx.layout, ctx.master);
  const spPr = child(el, P, 'spPr');
  const style = child(el, P, 'style');
  const xfrm = [spPr, ...phChain.map((p) => child(p, P, 'spPr'))]
    .map((s) => child(s, A, 'xfrm'))
    .find(Boolean);
  const text = paragraphsText(el);
  const fill = fillOf(spPr, style, ctx.styles.theme);
  const border = borderOf(spPr, style, ctx.styles.theme);
  if (!text.trim() && !fill && !border) return;
  const at = place(ctx, xfrm, t);
  const geom = child(spPr, A, 'prstGeom');
  const prst = geom?.getAttribute('prst') ?? (child(spPr, A, 'custGeom') ? 'custom' : 'rect');
  if (STRAIGHT_LINE.test(prst)) {
    if (border) readLine(ctx, spPr, at, border, fromLayout);
    return;
  }
  if (!at.w || !at.h) return;
  const drawable = DRAWABLE.test(prst);
  if (!drawable) {
    if ((fill || border) && !drawShape(ctx, spPr, at, t, fill, border)) ctx.diagrams.push(at);
    if (text.trim().length < 3) return;
  }
  const read = readText(el, owner, phChain, ctx.styles);
  const visible = (r: DeckRun) => !r.br && r.text.trim() && r.colour !== fill;
  const invisible = read.paras.every((p) => !p.runs.some(visible));
  const shapeLink = externalLink(
    owner,
    child(el.getElementsByTagNameNS(P, 'cNvPr')[0], A, 'hlinkClick'),
  );
  const paras = invisible
    ? []
    : read.paras.map((p) => ({
        ...p,
        runs: p.runs.map((r) => (r.link || !shapeLink ? r : { ...r, link: shapeLink })),
      }));
  addShape(ctx, {
    ...at,
    text: invisible ? '' : text,
    paras,
    valign: read.valign,
    insets: read.insets,
    placeholder: ph?.type,
    fromLayout: fromLayout || undefined,
    fill: drawable ? fill : undefined,
    border: drawable ? border : undefined,
    corners: prst === 'round2SameRect' ? 'top' : undefined,
    radius: radiusOf(ctx, geom, at),
  });
}

function readTable(ctx: SlideContext, el: Element, t: Transform, owner: Part, fromLayout: boolean) {
  const tbl = el.getElementsByTagNameNS(A, 'tbl')[0];
  if (!tbl) return;
  const frame = place(ctx, child(el, P, 'xfrm'), t);
  const cols = Array.from(tbl.getElementsByTagNameNS(A, 'gridCol')).map((c) => num(c, 'w'));
  const rows = Array.from(tbl.children).filter((c) => c.localName === 'tr');
  const totalW = cols.reduce((a, b) => a + b, 0) || 1;
  const colX = cols.map((_, i) => cols.slice(0, i).reduce((a, b) => a + b, 0) / totalW);
  const rowTop = (i: number) =>
    yPct(ctx, rows.slice(0, i).reduce((a, r) => a + num(r, 'h'), 0) / EMU_PER_PT) * t.sy;
  const table = `table${ctx.shapes.length}`;
  rows.forEach((tr, ri) => {
    Array.from(tr.children)
      .filter((c) => c.localName === 'tc')
      .forEach((tc, ci) => {
        if (tc.getAttribute('hMerge') === '1' || tc.getAttribute('vMerge') === '1') return;
        const span = Number(tc.getAttribute('gridSpan') ?? 1);
        const rowSpan = Number(tc.getAttribute('rowSpan') ?? 1);
        const tcPr = child(tc, A, 'tcPr');
        const gap = (side: string) => {
          const ln = child(tcPr, A, `ln${side}`);
          const colour = colourOf(child(ln, A, 'solidFill'), ctx.styles.theme);
          return colour && /^#F[0-9A-F]F[0-9A-F]F[0-9A-F]$/i.test(colour)
            ? num(ln, 'w') / EMU_PER_PT / 2
            : 0;
        };
        const x0 = colX[ci];
        const x1 = ci + span < cols.length ? colX[ci + span] : 1;
        const y0 = rowTop(ri);
        const y1 = rowTop(Math.min(rows.length, ri + rowSpan));
        const fill = child(tcPr, A, 'noFill')
          ? undefined
          : colourOf(child(tcPr, A, 'solidFill'), ctx.styles.theme);
        const text = paragraphsText(tc);
        if (!text.trim() && !fill) return;
        const read = readText(tc, owner, [], ctx.styles);
        const margin = (name: string, fallback: number) =>
          Number(tcPr?.getAttribute(name) ?? fallback) / EMU_PER_PT;
        addShape(ctx, {
          x: round1(frame.x + x0 * frame.w + xPct(ctx, gap('L'))),
          y: round1(frame.y + y0 + yPct(ctx, gap('T'))),
          w: round1((x1 - x0) * frame.w - xPct(ctx, gap('L') + gap('R'))),
          h: round1(y1 - y0 - yPct(ctx, gap('T') + gap('B'))),
          r: 0,
          cell: { table, row: ri, rowSpan, gapT: yPct(ctx, gap('T')), gapB: yPct(ctx, gap('B')) },
          text,
          paras: read.paras,
          valign: VALIGN[tcPr?.getAttribute('anchor') ?? 't'] ?? read.valign,
          insets: [
            margin('marT', 45720),
            margin('marR', 91440),
            margin('marB', 45720),
            margin('marL', 91440),
          ],
          fromLayout: fromLayout || undefined,
          fill,
          radius: fill ? 0 : undefined,
        });
      });
  });
}

async function readPicture(ctx: SlideContext, el: Element, t: Transform, owner: Part) {
  const embed = Array.from(el.getElementsByTagName('*'))
    .filter((e) => e.localName === 'svgBlip' || e.localName === 'blip')
    .sort((a, b) => Number(b.localName === 'svgBlip') - Number(a.localName === 'svgBlip'))
    .map((b) => b.getAttributeNS(R, 'embed'))
    .find((id) => id && owner.rels[id]);
  const target = embed ? owner.rels[embed]?.target : undefined;
  if (!target || !USABLE_MEDIA.test(target)) return;
  const name = target.split('/').pop()!;
  if (!ctx.media[name]) {
    ctx.media[name] = new Blob([await ctx.zip.file(target)!.async('arraybuffer')], {
      type: MIME[name.split('.').pop()!.toLowerCase()],
    });
    ctx.light[name] = await isLightArtwork(ctx.media[name]);
  }
  const spPr = child(el, P, 'spPr');
  const at = place(ctx, child(spPr, A, 'xfrm'), t);
  const src = child(child(el, P, 'blipFill'), A, 'srcRect');
  const crop = src
    ? (['t', 'r', 'b', 'l'].map((k) => num(src, k) / 1000) as [number, number, number, number])
    : undefined;
  ctx.order.push({ kind: 'image', index: ctx.images.length });
  ctx.images.push({
    media: name,
    ...at,
    light: ctx.light[name],
    crop: crop?.some(Boolean) ? crop : undefined,
    radius: radiusOf(ctx, child(spPr, A, 'prstGeom'), at),
    border: borderOf(spPr, child(el, P, 'style'), ctx.styles.theme),
  });
}

function groupTransform(el: Element, t: Transform): Transform {
  const xfrm = child(child(el, P, 'grpSpPr'), A, 'xfrm');
  const off = child(xfrm, A, 'off');
  const ext = child(xfrm, A, 'ext');
  const chOff = child(xfrm, A, 'chOff');
  const chExt = child(xfrm, A, 'chExt');
  const sx = num(chExt, 'cx') ? num(ext, 'cx') / num(chExt, 'cx') : 1;
  const sy = num(chExt, 'cy') ? num(ext, 'cy') / num(chExt, 'cy') : 1;
  return {
    ox: t.ox + (num(off, 'x') - num(chOff, 'x') * sx) * t.sx,
    oy: t.oy + (num(off, 'y') - num(chOff, 'y') * sy) * t.sy,
    sx: sx * t.sx,
    sy: sy * t.sy,
  };
}

export async function walkTree(
  ctx: SlideContext,
  tree: Element,
  t: Transform,
  owner: Part,
  fromLayout: boolean,
): Promise<void> {
  for (const el of Array.from(tree.children)) {
    if (el.getElementsByTagNameNS(P, 'cNvPr')[0]?.getAttribute('hidden') === '1') continue;
    if (el.localName === 'grpSp') await walkTree(ctx, el, groupTransform(el, t), owner, fromLayout);
    else if (el.localName === 'sp' || el.localName === 'cxnSp')
      readShape(ctx, el, t, owner, fromLayout);
    else if (el.localName === 'graphicFrame') readTable(ctx, el, t, owner, fromLayout);
    else if (el.localName === 'pic') await readPicture(ctx, el, t, owner);
  }
}
