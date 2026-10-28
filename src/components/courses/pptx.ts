import JSZip from 'jszip';

export type DeckAlign = 'left' | 'center' | 'right' | 'justify';

export interface DeckRun {
  text: string;
  br?: boolean;
  colour?: string;
  size: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  baseline?: number;
  font?: string;
  highlight?: string;
  link?: string;
}

export interface DeckPara {
  runs: DeckRun[];
  align: DeckAlign;
  level: number;
  bullet?: 'dot' | 'num';
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
}

export interface DeckBorder {
  colour: string;
  width: number;
}

export interface DeckCell {
  table: string;
  row: number;
  rowSpan: number;
  gapT: number;
  gapB: number;
}

export interface DeckShape {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  text: string;
  paras: DeckPara[];
  valign: 'top' | 'middle' | 'bottom';
  insets: [number, number, number, number];
  placeholder?: string;
  fromLayout?: boolean;
  cell?: DeckCell;
  fill?: string;
  border?: DeckBorder;
  colour?: string;
  geometry?: string;
  radius?: number;
  corners?: 'top';
  size?: number;
  bold?: boolean;
  link?: string;
}

export interface DeckImage {
  media: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  light: boolean;
  fromLayout?: boolean;
  crop?: [number, number, number, number];
  radius?: number;
  border?: DeckBorder;
}

export interface DeckDiagram {
  geometry: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DeckSlide {
  number: number;
  hidden: boolean;
  background?: string;
  diagrams: DeckDiagram[];
  shapes: DeckShape[];
  images: DeckImage[];
  order: ({ kind: 'shape'; index: number } | { kind: 'image'; index: number })[];
  notes: string;
  comments: string[];
}

export interface Deck {
  widthPt: number;
  heightPt: number;
  slides: DeckSlide[];
  media: Record<string, Blob>;
}

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU_PER_PT = 12700;
const USABLE_MEDIA = /\.(png|jpe?g|gif|svg)$/i;
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

interface Box {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

type Rels = Record<string, { type: string; target: string; external: boolean }>;

interface Theme {
  colours: Record<string, string>;
  majorFont?: string;
  minorFont?: string;
  lineWidths: number[];
}

interface Part {
  path: string;
  xml: Document;
  rels: Rels;
}

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

const child = (el: Element | undefined | null, ns: string, name: string) =>
  el
    ? Array.from(el.children).find((c) => c.namespaceURI === ns && c.localName === name)
    : undefined;

const num = (el: Element | undefined, attr: string) => Number(el?.getAttribute(attr) ?? 0);

const round1 = (v: number) => Math.round(v * 10) / 10;

function resolvePath(base: string, target: string): string {
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

async function readRels(zip: JSZip, part: string): Promise<Rels> {
  const relPath = part.replace(/([^/]+)$/, '_rels/$1.rels');
  const file = zip.file(relPath);
  const rels: Rels = {};
  if (!file) return rels;
  for (const r of Array.from(parseXml(await file.async('string')).getElementsByTagName('*'))) {
    if (r.localName !== 'Relationship') continue;
    const external = r.getAttribute('TargetMode') === 'External';
    const target = r.getAttribute('Target') ?? '';
    rels[r.getAttribute('Id') ?? ''] = {
      type: r.getAttribute('Type') ?? '',
      target: external ? target : resolvePath(part, target),
      external,
    };
  }
  return rels;
}

async function readPart(zip: JSZip, path: string): Promise<Part | undefined> {
  const file = zip.file(path);
  if (!file) return undefined;
  return { path, xml: parseXml(await file.async('string')), rels: await readRels(zip, path) };
}

const relOf = (part: Part, type: string) =>
  Object.values(part.rels).find((r) => r.type.endsWith(`/${type}`));

function paragraphsText(el: Element): string {
  return Array.from(el.getElementsByTagNameNS(A, 'p'))
    .map((p) =>
      Array.from(p.getElementsByTagNameNS(A, 't'))
        .map((t) => t.textContent ?? '')
        .join(''),
    )
    .filter((t) => t.trim())
    .join('\n');
}

function readTheme(themeXml: Document | undefined): Theme {
  const theme: Theme = { colours: {}, lineWidths: [] };
  if (!themeXml) return theme;
  const scheme = themeXml.getElementsByTagNameNS(A, 'clrScheme')[0];
  for (const el of Array.from(scheme?.children ?? [])) {
    const value = el.firstElementChild;
    const hex =
      value?.localName === 'sysClr' ? value.getAttribute('lastClr') : value?.getAttribute('val');
    if (hex) theme.colours[el.localName] = `#${hex}`;
  }
  const latin = (name: string) =>
    child(themeXml.getElementsByTagNameNS(A, name)[0], A, 'latin')?.getAttribute('typeface') ??
    undefined;
  theme.majorFont = latin('majorFont');
  theme.minorFont = latin('minorFont');
  const lines = themeXml.getElementsByTagNameNS(A, 'lnStyleLst')[0];
  theme.lineWidths = Array.from(lines?.children ?? []).map((ln) => num(ln, 'w') || 9525);
  return theme;
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex([h, s, l]: [number, number, number]): string {
  const hue = (p: number, q: number, t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = s === 0 ? [l, l, l] : [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const SCHEME_ALIAS: Record<string, string> = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };

function colourOf(el: Element | undefined, theme: Theme): string | undefined {
  const colour = child(el, A, 'srgbClr') ?? child(el, A, 'schemeClr') ?? child(el, A, 'sysClr');
  if (!colour) return undefined;
  const val = colour.getAttribute('val') ?? '';
  let hex =
    colour.localName === 'srgbClr'
      ? `#${val}`
      : colour.localName === 'sysClr'
        ? `#${colour.getAttribute('lastClr') ?? '000000'}`
        : theme.colours[SCHEME_ALIAS[val] ?? val];
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  let alpha = 1;
  const mods = Array.from(colour.children);
  if (mods.length) {
    const [h, s0, l0] = hexToHsl(hex);
    let s = s0;
    let l = l0;
    for (const mod of mods) {
      const v = num(mod, 'val') / 100000;
      if (mod.localName === 'lumMod') l *= v;
      else if (mod.localName === 'lumOff') l += v;
      else if (mod.localName === 'tint') l = l * v + (1 - v);
      else if (mod.localName === 'shade') l *= v;
      else if (mod.localName === 'satMod') s *= v;
      else if (mod.localName === 'alpha') alpha = v;
    }
    hex = hslToHex([h, Math.min(1, s), Math.min(1, Math.max(0, l))]);
  }
  if (alpha >= 0.99) return hex.toUpperCase();
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`;
}

function fillOf(spPr: Element | undefined, style: Element | undefined, theme: Theme) {
  if (child(spPr, A, 'noFill')) return undefined;
  const solid = child(spPr, A, 'solidFill');
  if (solid) return colourOf(solid, theme);
  const grad = child(spPr, A, 'gradFill');
  if (grad) return colourOf(grad.getElementsByTagNameNS(A, 'gs')[0], theme);
  if (child(spPr, A, 'blipFill') || child(spPr, A, 'pattFill')) return undefined;
  const ref = child(style, A, 'fillRef');
  return ref && num(ref, 'idx') > 0 ? colourOf(ref, theme) : undefined;
}

function borderOf(
  spPr: Element | undefined,
  style: Element | undefined,
  theme: Theme,
): DeckBorder | undefined {
  const ln = child(spPr, A, 'ln');
  const ref = child(style, A, 'lnRef');
  const refIdx = ref ? num(ref, 'idx') : 0;
  if (child(ln, A, 'noFill')) return undefined;
  const colour =
    colourOf(child(ln, A, 'solidFill'), theme) ??
    colourOf(child(ln, A, 'gradFill')?.getElementsByTagNameNS(A, 'gs')[0], theme) ??
    (refIdx > 0 ? colourOf(ref, theme) : undefined);
  if (!colour) return undefined;
  const width = num(ln, 'w') || theme.lineWidths[refIdx - 1] || 9525;
  return { colour, width: round1(width / EMU_PER_PT) };
}

async function isLightArtwork(blob: Blob): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;
    let seen = 0;
    let light = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      seen++;
      if (data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225) light++;
    }
    return seen > 0 && light / seen > 0.9 && seen < 48 * 48 * 0.9;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const placeholderOf = (sp: Element) => {
  const ph = sp.getElementsByTagNameNS(P, 'ph')[0];
  if (!ph) return undefined;
  return { type: ph.getAttribute('type') ?? 'body', idx: ph.getAttribute('idx') };
};

const isTitle = (type: string | undefined) => type === 'title' || type === 'ctrTitle';

function findPlaceholder(part: Part | undefined, type: string, idx: string | null) {
  if (!part) return undefined;
  const shapes = Array.from(part.xml.getElementsByTagNameNS(P, 'sp'));
  const withPh = shapes.map((sp) => ({ sp, ph: placeholderOf(sp) })).filter((s) => s.ph);
  const sameKind = (t: string) => (isTitle(type) ? isTitle(t) : !isTitle(t));
  return (
    (idx ? withPh.find((s) => s.ph!.idx === idx) : undefined) ??
    withPh.find((s) => s.ph!.type === type) ??
    withPh.find(
      (s) =>
        sameKind(s.ph!.type) &&
        s.ph!.type !== 'dt' &&
        s.ph!.type !== 'ftr' &&
        s.ph!.type !== 'sldNum',
    )
  )?.sp;
}

const DRAWABLE =
  /^(rect|roundRect|round2SameRect|ellipse|flowChartProcess|flowChartAlternateProcess)$/;
const STRAIGHT_LINE = /^(line|straightConnector1)$/;

const ALIGN: Record<string, DeckAlign> = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
const VALIGN: Record<string, DeckShape['valign']> = { t: 'top', ctr: 'middle', b: 'bottom' };

export async function readPptx(file: Blob): Promise<Deck> {
  const zip = await JSZip.loadAsync(file);
  const presPart = 'ppt/presentation.xml';
  const pres = parseXml(await zip.file(presPart)!.async('string'));
  const size = pres.getElementsByTagNameNS(P, 'sldSz')[0];
  const slideW = num(size, 'cx') || 12192000;
  const slideH = num(size, 'cy') || 6858000;
  const presRels = await readRels(zip, presPart);
  const order = Array.from(pres.getElementsByTagNameNS(P, 'sldId')).map(
    (s) => presRels[s.getAttributeNS(R, 'id') ?? '']?.target,
  );
  const defaultTextStyle = pres.getElementsByTagNameNS(P, 'defaultTextStyle')[0];

  const media: Record<string, Blob> = {};
  const light: Record<string, boolean> = {};
  const parts = new Map<string, Part | undefined>();
  const part = async (path: string | undefined) => {
    if (!path) return undefined;
    if (!parts.has(path)) parts.set(path, await readPart(zip, path));
    return parts.get(path);
  };
  const themes = new Map<string, Theme>();
  const themeFor = async (master: Part | undefined) => {
    const target = master && relOf(master, 'theme')?.target;
    if (!target) return readTheme(undefined);
    if (!themes.has(target)) themes.set(target, readTheme((await part(target))?.xml));
    return themes.get(target)!;
  };

  const slides: DeckSlide[] = [];

  for (const [i, slidePath] of order.entries()) {
    const slide = await part(slidePath);
    if (!slide) continue;
    const layout = await part(relOf(slide, 'slideLayout')?.target);
    const master = layout ? await part(relOf(layout, 'slideMaster')?.target) : undefined;
    const theme = await themeFor(master);
    const txStyles = master?.xml.getElementsByTagNameNS(P, 'txStyles')[0];

    const shapes: DeckShape[] = [];
    const images: DeckImage[] = [];
    const diagrams: DeckDiagram[] = [];
    const drawOrder: DeckSlide['order'] = [];

    const fontName = (typeface: string | null | undefined) => {
      if (!typeface) return undefined;
      if (typeface.startsWith('+mj')) return theme.majorFont;
      if (typeface.startsWith('+mn')) return theme.minorFont;
      return typeface;
    };

    const place = (xfrm: Element | undefined, box: Box) => {
      const off = xfrm && child(xfrm, A, 'off');
      const ext = xfrm && child(xfrm, A, 'ext');
      const x = box.ox + num(off, 'x') * box.sx;
      const y = box.oy + num(off, 'y') * box.sy;
      const pct = (v: number, of: number) => round1((v / of) * 100);
      return {
        x: pct(x, slideW),
        y: pct(y, slideH),
        w: pct(num(ext, 'cx') * box.sx, slideW),
        h: pct(num(ext, 'cy') * box.sy, slideH),
        r: Math.round(num(xfrm, 'rot') / 60000),
      };
    };

    const radiusOf = (geom: Element | undefined, at: { w: number; h: number }) => {
      const prst = geom?.getAttribute('prst') ?? '';
      const shortSide = Math.min(at.w * 9.6, (at.h * 9.6 * slideH) / slideW);
      if (prst === 'ellipse') return Math.round(shortSide / 2);
      if (!/^(roundRect|round2SameRect)$/.test(prst)) return undefined;
      const adj = geom
        ?.getElementsByTagNameNS(A, 'gd')[0]
        ?.getAttribute('fmla')
        ?.match(/val (\d+)/)?.[1];
      return Math.round((Number(adj ?? 16667) / 100000) * shortSide);
    };

    const readText = (sp: Element, owner: Part, phChain: Element[]) => {
      const ph = placeholderOf(sp);
      const txBody = child(sp, P, 'txBody') ?? child(sp, A, 'txBody');
      const styleSection = !ph
        ? (child(txStyles, P, 'otherStyle') ?? defaultTextStyle)
        : isTitle(ph.type)
          ? child(txStyles, P, 'titleStyle')
          : child(txStyles, P, 'bodyStyle');
      const lstStyles = [
        child(txBody, A, 'lstStyle'),
        ...phChain.map((p) => child(child(p, P, 'txBody'), A, 'lstStyle')),
        styleSection,
        ...(ph ? [] : [defaultTextStyle]),
      ];
      const fontRef = child(child(sp, P, 'style'), A, 'fontRef');
      const bodyPrs = [
        child(txBody, A, 'bodyPr'),
        ...phChain.map((p) => child(child(p, P, 'txBody'), A, 'bodyPr')),
      ];
      const bodyAttr = (name: string) =>
        bodyPrs.find((b) => b?.hasAttribute(name))?.getAttribute(name) ?? undefined;
      const insets: [number, number, number, number] = [
        Number(bodyAttr('tIns') ?? 45720) / EMU_PER_PT,
        Number(bodyAttr('rIns') ?? 91440) / EMU_PER_PT,
        Number(bodyAttr('bIns') ?? 45720) / EMU_PER_PT,
        Number(bodyAttr('lIns') ?? 91440) / EMU_PER_PT,
      ];
      const valign = VALIGN[bodyAttr('anchor') ?? 't'] ?? 'top';
      const autofit = bodyPrs[0] && child(bodyPrs[0], A, 'normAutofit');
      const fontScale = autofit ? (num(autofit, 'fontScale') || 100000) / 100000 : 1;

      const paras: DeckPara[] = [];
      for (const p of Array.from(txBody?.children ?? []).filter((c) => c.localName === 'p')) {
        const pPr = child(p, A, 'pPr');
        const level = num(pPr, 'lvl');
        const levelPrs = [pPr, ...lstStyles.map((s) => child(s, A, `lvl${level + 1}pPr`))];
        const pAttr = (name: string) =>
          levelPrs.find((l) => l?.hasAttribute(name))?.getAttribute(name) ?? undefined;
        const pChild = (names: string[]) => {
          for (const l of levelPrs) {
            const found = names.map((n) => child(l, A, n)).find(Boolean);
            if (found) return found;
          }
          return undefined;
        };
        const defRPrs = levelPrs.slice(1).map((l) => child(l, A, 'defRPr'));
        const runs: DeckRun[] = [];
        for (const r of Array.from(p.children)) {
          if (r.localName === 'br') {
            runs.push({ text: '', br: true, size: 0 });
            continue;
          }
          if (r.localName !== 'r' && r.localName !== 'fld') continue;
          const rPr = child(r, A, 'rPr');
          const chain = [rPr, ...defRPrs];
          const rAttr = (name: string) =>
            chain.find((c) => c?.hasAttribute(name))?.getAttribute(name) ?? undefined;
          const colourChain = [rPr, defRPrs[0]];
          const colour =
            colourChain.map((c) => colourOf(child(c, A, 'solidFill'), theme)).find(Boolean) ??
            colourOf(fontRef, theme) ??
            defRPrs
              .slice(1)
              .map((c) => colourOf(child(c, A, 'solidFill'), theme))
              .find(Boolean);
          const linkId = child(rPr, A, 'hlinkClick')?.getAttributeNS(R, 'id');
          const link = linkId ? owner.rels[linkId] : undefined;
          const baseline = Number(rAttr('baseline') ?? 0) / 1000;
          runs.push({
            text: child(r, A, 't')?.textContent ?? '',
            colour,
            size: round1((Number(rAttr('sz') ?? 1800) / 100) * fontScale),
            bold: rAttr('b') === '1' || rAttr('b') === 'true' || undefined,
            italic: rAttr('i') === '1' || rAttr('i') === 'true' || undefined,
            underline: (rAttr('u') ?? 'none') !== 'none' || undefined,
            strike: (rAttr('strike') ?? 'noStrike') !== 'noStrike' || undefined,
            baseline: baseline || undefined,
            font: fontName(
              chain.map((c) => child(c, A, 'latin')?.getAttribute('typeface')).find(Boolean),
            ),
            highlight: colourOf(child(rPr, A, 'highlight'), theme),
            link: link?.external ? link.target : undefined,
          });
        }
        const bullet = pChild(['buNone', 'buChar', 'buAutoNum', 'buBlip']);
        const spacing = (name: string) => {
          const el = pChild([name]);
          const pct = child(el, A, 'spcPct');
          const pts = child(el, A, 'spcPts');
          if (pct) return { pct: num(pct, 'val') / 100000 };
          if (pts) return { pt: num(pts, 'val') / 100 };
          return undefined;
        };
        const lnSpc = spacing('lnSpc');
        const firstSize = runs.find((r) => !r.br)?.size ?? 18;
        const before = spacing('spcBef');
        const after = spacing('spcAft');
        const asPt = (s: { pct?: number; pt?: number } | undefined) =>
          s ? round1(s.pt ?? (s.pct ?? 0) * firstSize) : undefined;
        paras.push({
          runs,
          align: ALIGN[pAttr('algn') ?? 'l'] ?? 'left',
          level,
          bullet:
            bullet?.localName === 'buChar' || bullet?.localName === 'buBlip'
              ? 'dot'
              : bullet?.localName === 'buAutoNum'
                ? 'num'
                : undefined,
          lineHeight: lnSpc?.pct
            ? Math.round(lnSpc.pct * 1.2 * 100) / 100
            : lnSpc?.pt
              ? Math.round((lnSpc.pt / firstSize) * 100) / 100
              : undefined,
          spaceBefore: asPt(before) || undefined,
          spaceAfter: asPt(after) || undefined,
        });
      }
      return { paras, insets, valign };
    };

    const walk = async (tree: Element, box: Box, owner: Part, fromLayout: boolean) => {
      for (const el of Array.from(tree.children)) {
        const nv = el.getElementsByTagNameNS(P, 'cNvPr')[0];
        if (nv?.getAttribute('hidden') === '1') continue;
        const name = nv?.getAttribute('name') ?? '';
        if (el.localName === 'grpSp') {
          const xfrm = child(child(el, P, 'grpSpPr'), A, 'xfrm');
          const off = xfrm && child(xfrm, A, 'off');
          const ext = xfrm && child(xfrm, A, 'ext');
          const chOff = xfrm && child(xfrm, A, 'chOff');
          const chExt = xfrm && child(xfrm, A, 'chExt');
          const sx = num(chExt, 'cx') ? num(ext, 'cx') / num(chExt, 'cx') : 1;
          const sy = num(chExt, 'cy') ? num(ext, 'cy') / num(chExt, 'cy') : 1;
          await walk(
            el,
            {
              ox: box.ox + (num(off, 'x') - num(chOff, 'x') * sx) * box.sx,
              oy: box.oy + (num(off, 'y') - num(chOff, 'y') * sy) * box.sy,
              sx: sx * box.sx,
              sy: sy * box.sy,
            },
            owner,
            fromLayout,
          );
        } else if (el.localName === 'sp' || el.localName === 'cxnSp') {
          const ph = placeholderOf(el);
          if (fromLayout && ph) continue;
          const phChain: Element[] = [];
          if (ph && !fromLayout) {
            const onLayout = findPlaceholder(layout, ph.type, ph.idx);
            if (onLayout) phChain.push(onLayout);
            const onMaster = findPlaceholder(master, ph.type, null);
            if (onMaster) phChain.push(onMaster);
          }
          const spPr = child(el, P, 'spPr');
          const style = child(el, P, 'style');
          const xfrm = [spPr, ...phChain.map((p) => child(p, P, 'spPr'))]
            .map((s) => child(s, A, 'xfrm'))
            .find(Boolean);
          const text = paragraphsText(el);
          const fill = fillOf(spPr, style, theme);
          const border = borderOf(spPr, style, theme);
          if (!text.trim() && !fill && !border) continue;
          const at = place(xfrm, box);
          const geom = child(spPr, A, 'prstGeom');
          const prst =
            geom?.getAttribute('prst') ?? (child(spPr, A, 'custGeom') ? 'custom' : 'rect');
          const pushBox = (
            f: { x: number; y: number; w: number; h: number; r?: number },
            colour: string,
            round: number | undefined,
          ) => {
            drawOrder.push({ kind: 'shape', index: shapes.length });
            shapes.push({
              name,
              ...f,
              r: f.r ?? 0,
              text: '',
              paras: [],
              valign: 'top',
              insets: [0, 0, 0, 0],
              fromLayout: fromLayout || undefined,
              fill: colour,
              geometry: 'rect',
              radius: round,
            });
          };
          if (STRAIGHT_LINE.test(prst)) {
            if (!border) continue;
            const ln = child(spPr, A, 'ln');
            const lineXfrm = child(spPr, A, 'xfrm');
            const pxX = (pct: number) => (pct / 100) * 960;
            const pxY = (pct: number) => (pct / 100) * ((960 * slideH) / slideW);
            const flipH = lineXfrm?.getAttribute('flipH') === '1';
            const flipV = lineXfrm?.getAttribute('flipV') === '1';
            const x0 = pxX(flipH ? at.x + at.w : at.x);
            const x1 = pxX(flipH ? at.x : at.x + at.w);
            const y0 = pxY(flipV ? at.y + at.h : at.y);
            const y1 = pxY(flipV ? at.y : at.y + at.h);
            const thick = border.width * (960 / (slideW / EMU_PER_PT));
            const length = Math.hypot(x1 - x0, y1 - y0);
            const toFrame = (cx: number, cy: number, w: number, h: number, r: number) => ({
              x: round1(((cx - w / 2) / 960) * 100),
              y: round1(((cy - h / 2) / pxY(100)) * 100),
              w: round1((w / 960) * 100),
              h: round1((h / pxY(100)) * 100),
              r,
            });
            pushBox(
              toFrame(
                (x0 + x1) / 2,
                (y0 + y1) / 2,
                length,
                thick,
                Math.round((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI),
              ),
              border.colour,
              ln?.getAttribute('cap') === 'rnd' ? Math.round(thick / 2) : undefined,
            );
            const ends = [
              { el: child(ln, A, 'headEnd'), x: x0, y: y0 },
              { el: child(ln, A, 'tailEnd'), x: x1, y: y1 },
            ];
            for (const end of ends) {
              const type = end.el?.getAttribute('type');
              if (!type || type === 'none') continue;
              if (type !== 'oval') {
                diagrams.push({
                  geometry: `${type} line end`,
                  ...toFrame(end.x, end.y, thick * 4, thick * 4, 0),
                });
                continue;
              }
              pushBox(
                toFrame(end.x, end.y, thick * 3, thick * 3, 0),
                border.colour,
                Math.round(thick * 1.5),
              );
            }
            continue;
          }
          if (!at.w || !at.h) continue;
          if (!DRAWABLE.test(prst)) {
            if (fill || border)
              diagrams.push({ geometry: prst, x: at.x, y: at.y, w: at.w, h: at.h });
            if (text.trim().length < 3) continue;
          }
          const drawable = DRAWABLE.test(prst);
          const { paras, insets, valign } = readText(el, owner, phChain);
          const runs = paras.flatMap((p) => p.runs).filter((r) => !r.br && r.text.trim());
          const linkId = el.getElementsByTagNameNS(A, 'hlinkClick')[0]?.getAttributeNS(R, 'id');
          const link = linkId ? owner.rels[linkId] : undefined;
          drawOrder.push({ kind: 'shape', index: shapes.length });
          shapes.push({
            name,
            ...at,
            text,
            paras,
            valign,
            insets,
            placeholder: ph?.type,
            fromLayout: fromLayout || undefined,
            fill: drawable ? fill : undefined,
            border: drawable ? border : undefined,
            colour: runs[0]?.colour,
            geometry: geom?.getAttribute('prst') ?? undefined,
            corners: geom?.getAttribute('prst') === 'round2SameRect' ? 'top' : undefined,
            radius: radiusOf(geom, at),
            size: runs[0]?.size,
            bold: runs.length > 0 && runs.every((r) => r.bold) ? true : undefined,
            link: link?.external ? link.target : undefined,
          });
        } else if (el.localName === 'graphicFrame') {
          const tbl = el.getElementsByTagNameNS(A, 'tbl')[0];
          if (!tbl) continue;
          const frame = place(child(el, P, 'xfrm'), box);
          const cols = Array.from(tbl.getElementsByTagNameNS(A, 'gridCol')).map((c) => num(c, 'w'));
          const rows = Array.from(tbl.children).filter((c) => c.localName === 'tr');
          const totalW = cols.reduce((a, b) => a + b, 0) || 1;
          const colX = cols.map((_, i) => cols.slice(0, i).reduce((a, b) => a + b, 0) / totalW);
          const xPct = (pt: number) => (pt / (slideW / EMU_PER_PT)) * 100;
          const yPct = (pt: number) => (pt / (slideH / EMU_PER_PT)) * 100;
          const rowTop = (i: number) =>
            yPct(rows.slice(0, i).reduce((a, r) => a + num(r, 'h'), 0) / EMU_PER_PT) * box.sy;
          const tableKey = `${name}#${shapes.length}`;
          rows.forEach((tr, ri) => {
            const cells = Array.from(tr.children).filter((c) => c.localName === 'tc');
            cells.forEach((tc, ci) => {
              if (tc.getAttribute('hMerge') === '1' || tc.getAttribute('vMerge') === '1') return;
              const span = Number(tc.getAttribute('gridSpan') ?? 1);
              const rowSpan = Number(tc.getAttribute('rowSpan') ?? 1);
              const tcPr = child(tc, A, 'tcPr');
              const gap = (side: string) => {
                const ln = child(tcPr, A, `ln${side}`);
                const colour = colourOf(child(ln, A, 'solidFill'), theme);
                return colour && /^#F[0-9A-F]F[0-9A-F]F[0-9A-F]$/i.test(colour)
                  ? num(ln, 'w') / EMU_PER_PT / 2
                  : 0;
              };
              const x0 = colX[ci];
              const x1 = ci + span < cols.length ? colX[ci + span] : 1;
              const y0 = rowTop(ri);
              const y1 = rowTop(Math.min(rows.length, ri + rowSpan));
              const at = {
                x: round1(frame.x + x0 * frame.w + xPct(gap('L'))),
                y: round1(frame.y + y0 + yPct(gap('T'))),
                w: round1((x1 - x0) * frame.w - xPct(gap('L') + gap('R'))),
                h: round1(y1 - y0 - yPct(gap('T') + gap('B'))),
                r: 0,
              };
              const { paras, valign } = readText(tc, owner, []);
              const mar = (name: string, fallback: number) =>
                Number(tcPr?.getAttribute(name) ?? fallback) / EMU_PER_PT;
              const fill = child(tcPr, A, 'noFill')
                ? undefined
                : colourOf(child(tcPr, A, 'solidFill'), theme);
              const text = paragraphsText(tc);
              if (!text.trim() && !fill) return;
              const runs = paras.flatMap((p) => p.runs).filter((r) => !r.br && r.text.trim());
              drawOrder.push({ kind: 'shape', index: shapes.length });
              shapes.push({
                name: `${name} r${ri + 1}c${ci + 1}`,
                cell: {
                  table: tableKey,
                  row: ri,
                  rowSpan,
                  gapT: yPct(gap('T')),
                  gapB: yPct(gap('B')),
                },
                ...at,
                text,
                paras,
                valign: VALIGN[tcPr?.getAttribute('anchor') ?? 't'] ?? valign,
                insets: [
                  mar('marT', 45720),
                  mar('marR', 91440),
                  mar('marB', 45720),
                  mar('marL', 91440),
                ],
                fromLayout: fromLayout || undefined,
                fill,
                geometry: 'rect',
                radius: fill ? 0 : undefined,
                colour: runs[0]?.colour,
                size: runs[0]?.size,
              });
            });
          });
        } else if (el.localName === 'pic') {
          const blips = Array.from(el.getElementsByTagName('*')).filter(
            (e) => e.localName === 'svgBlip' || e.localName === 'blip',
          );
          const embed = blips
            .sort((a, b) => Number(b.localName === 'svgBlip') - Number(a.localName === 'svgBlip'))
            .map((b) => b.getAttributeNS(R, 'embed'))
            .find((id) => id && owner.rels[id]);
          const target = embed ? owner.rels[embed]?.target : undefined;
          if (!target || !USABLE_MEDIA.test(target)) continue;
          const mediaName = target.split('/').pop()!;
          if (!media[mediaName]) {
            media[mediaName] = new Blob([await zip.file(target)!.async('arraybuffer')], {
              type: MIME[mediaName.split('.').pop()!.toLowerCase()],
            });
            light[mediaName] = await isLightArtwork(media[mediaName]);
          }
          const spPr = child(el, P, 'spPr');
          const at = place(child(spPr, A, 'xfrm'), box);
          const src = child(child(el, P, 'blipFill'), A, 'srcRect');
          const crop = src
            ? (['t', 'r', 'b', 'l'].map((k) => num(src, k) / 1000) as [
                number,
                number,
                number,
                number,
              ])
            : undefined;
          drawOrder.push({ kind: 'image', index: images.length });
          images.push({
            media: mediaName,
            ...at,
            light: light[mediaName],
            fromLayout: fromLayout || undefined,
            crop: crop?.some(Boolean) ? crop : undefined,
            radius: radiusOf(child(spPr, A, 'prstGeom'), at),
            border: borderOf(spPr, child(el, P, 'style'), theme),
          });
        }
      }
    };

    const showMaster = (p: Part | undefined) =>
      p?.xml.documentElement.getAttribute('showMasterSp') !== '0';
    if (master && showMaster(layout) && showMaster(slide)) {
      const tree = master.xml.getElementsByTagNameNS(P, 'spTree')[0];
      if (tree) await walk(tree, { ox: 0, oy: 0, sx: 1, sy: 1 }, master, true);
    }
    if (layout && showMaster(slide)) {
      const tree = layout.xml.getElementsByTagNameNS(P, 'spTree')[0];
      if (tree) await walk(tree, { ox: 0, oy: 0, sx: 1, sy: 1 }, layout, true);
    }
    const tree = slide.xml.getElementsByTagNameNS(P, 'spTree')[0];
    if (tree) await walk(tree, { ox: 0, oy: 0, sx: 1, sy: 1 }, slide, false);

    const bg = [slide, layout, master]
      .map((p) => p?.xml.getElementsByTagNameNS(P, 'bg')[0])
      .find(Boolean);
    const bgPr = child(bg, P, 'bgPr');
    const background = bgPr
      ? fillOf(bgPr, undefined, theme)
      : colourOf(child(bg, P, 'bgRef'), theme);

    let notes = '';
    const comments: string[] = [];
    for (const rel of Object.values(slide.rels)) {
      if (rel.external || !zip.file(rel.target)) continue;
      if (rel.type.endsWith('/notesSlide')) {
        notes = paragraphsText(
          parseXml(await zip.file(rel.target)!.async('string')).documentElement,
        )
          .split('\n')
          .filter((line) => !/^\d+$/.test(line.trim()))
          .join('\n');
      } else if (rel.type.endsWith('/comments')) {
        const doc = parseXml(await zip.file(rel.target)!.async('string'));
        for (const body of Array.from(doc.getElementsByTagName('*')).filter(
          (e) => e.localName === 'txBody' || e.localName === 'text',
        ))
          if (body.textContent?.trim()) comments.push(paragraphsText(body) || body.textContent);
      }
    }

    slides.push({
      number: i + 1,
      hidden: slide.xml.documentElement.getAttribute('show') === '0',
      background,
      diagrams,
      shapes,
      images,
      order: drawOrder,
      notes,
      comments,
    });
  }

  return {
    widthPt: slideW / EMU_PER_PT,
    heightPt: slideH / EMU_PER_PT,
    slides,
    media,
  };
}
