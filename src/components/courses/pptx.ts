import JSZip from 'jszip';

export interface DeckShape {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
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
}

export interface DeckSlide {
  number: number;
  hidden: boolean;
  shapes: DeckShape[];
  images: DeckImage[];
  notes: string;
  comments: string[];
}

export interface Deck {
  slides: DeckSlide[];
  media: Record<string, Blob>;
}

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const USABLE_MEDIA = /\.(png|jpe?g|gif|svg)$/i;

interface Box {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

const child = (el: Element | undefined, ns: string, name: string) =>
  el && Array.from(el.children).find((c) => c.namespaceURI === ns && c.localName === name);

const num = (el: Element | undefined, attr: string) => Number(el?.getAttribute(attr) ?? 0);

function resolvePath(base: string, target: string): string {
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

async function readRels(zip: JSZip, part: string) {
  const relPath = part.replace(/([^/]+)$/, '_rels/$1.rels');
  const file = zip.file(relPath);
  const rels: Record<string, { type: string; target: string; external: boolean }> = {};
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

function tableText(frame: Element): string {
  return Array.from(frame.getElementsByTagNameNS(A, 'tr'))
    .map(
      (tr) =>
        '| ' +
        Array.from(tr.getElementsByTagNameNS(A, 'tc'))
          .map((tc) => paragraphsText(tc).replace(/\n/g, ' / '))
          .join(' | ') +
        ' |',
    )
    .join('\n');
}

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

  const media: Record<string, Blob> = {};
  const slides: DeckSlide[] = [];

  for (const [i, part] of order.entries()) {
    if (!part || !zip.file(part)) continue;
    const xml = parseXml(await zip.file(part)!.async('string'));
    const rels = await readRels(zip, part);
    const shapes: DeckShape[] = [];
    const images: DeckImage[] = [];

    const place = (xfrm: Element | undefined, box: Box) => {
      const off = xfrm && child(xfrm, A, 'off');
      const ext = xfrm && child(xfrm, A, 'ext');
      const x = box.ox + num(off, 'x') * box.sx;
      const y = box.oy + num(off, 'y') * box.sy;
      const pct = (v: number, of: number) => Math.round((v / of) * 1000) / 10;
      return {
        x: pct(x, slideW),
        y: pct(y, slideH),
        w: pct(num(ext, 'cx') * box.sx, slideW),
        h: pct(num(ext, 'cy') * box.sy, slideH),
        r: Math.round(num(xfrm, 'rot') / 60000),
      };
    };

    const walk = async (tree: Element, box: Box) => {
      for (const el of Array.from(tree.children)) {
        const nv = el.getElementsByTagNameNS(P, 'cNvPr')[0];
        const name = nv?.getAttribute('name') ?? '';
        if (el.localName === 'grpSp') {
          const xfrm = child(child(el, P, 'grpSpPr'), A, 'xfrm');
          const off = xfrm && child(xfrm, A, 'off');
          const ext = xfrm && child(xfrm, A, 'ext');
          const chOff = xfrm && child(xfrm, A, 'chOff');
          const chExt = xfrm && child(xfrm, A, 'chExt');
          const sx = num(chExt, 'cx') ? num(ext, 'cx') / num(chExt, 'cx') : 1;
          const sy = num(chExt, 'cy') ? num(ext, 'cy') / num(chExt, 'cy') : 1;
          await walk(el, {
            ox: box.ox + (num(off, 'x') - num(chOff, 'x') * sx) * box.sx,
            oy: box.oy + (num(off, 'y') - num(chOff, 'y') * sy) * box.sy,
            sx: sx * box.sx,
            sy: sy * box.sy,
          });
        } else if (el.localName === 'sp') {
          const text = paragraphsText(el);
          if (!text.trim()) continue;
          const run = el.getElementsByTagNameNS(A, 'rPr')[0];
          const linkId = el.getElementsByTagNameNS(A, 'hlinkClick')[0]?.getAttributeNS(R, 'id');
          const link = linkId ? rels[linkId] : undefined;
          shapes.push({
            name,
            ...place(child(child(el, P, 'spPr'), A, 'xfrm'), box),
            text,
            size: run?.getAttribute('sz') ? num(run, 'sz') / 100 : undefined,
            bold: run?.getAttribute('b') === '1' || undefined,
            link: link?.external ? link.target : undefined,
          });
        } else if (el.localName === 'graphicFrame') {
          const text = tableText(el);
          if (text) shapes.push({ name, ...place(child(el, P, 'xfrm'), box), text });
        } else if (el.localName === 'pic') {
          const blips = Array.from(el.getElementsByTagName('*')).filter(
            (e) => e.localName === 'svgBlip' || e.localName === 'blip',
          );
          const embed = blips
            .sort((a, b) => Number(b.localName === 'svgBlip') - Number(a.localName === 'svgBlip'))
            .map((b) => b.getAttributeNS(R, 'embed'))
            .find((id) => id && rels[id]);
          const target = embed ? rels[embed]?.target : undefined;
          if (!target || !USABLE_MEDIA.test(target)) continue;
          const mediaName = target.split('/').pop()!;
          if (!media[mediaName]) media[mediaName] = await zip.file(target)!.async('blob');
          images.push({
            media: mediaName,
            ...place(child(child(el, P, 'spPr'), A, 'xfrm'), box),
          });
        }
      }
    };

    const tree = xml.getElementsByTagNameNS(P, 'spTree')[0];
    if (tree) await walk(tree, { ox: 0, oy: 0, sx: 1, sy: 1 });

    let notes = '';
    const comments: string[] = [];
    for (const rel of Object.values(rels)) {
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
      hidden: xml.documentElement.getAttribute('show') === '0',
      shapes,
      images,
      notes,
      comments,
    });
  }

  return { slides, media };
}
