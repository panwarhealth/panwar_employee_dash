import JSZip from 'jszip';
import { loadPresets } from './presets';
import { IDENTITY, walkTree, type SlideContext } from './shapes';
import { colourOf, fillOf, readTheme, type Theme } from './theme';
import type { Deck, DeckSlide } from './types';
import {
  child,
  EMU_PER_PT,
  num,
  P,
  paragraphsText,
  parseXml,
  R,
  readPart,
  readRels,
  relOf,
  type Part,
} from './xml';

export type * from './types';

async function readNotes(zip: JSZip, slide: Part) {
  let notes = '';
  const comments: string[] = [];
  for (const rel of Object.values(slide.rels)) {
    const isNotes = rel.type.endsWith('/notesSlide');
    const isComments = rel.type.endsWith('/comments');
    if (rel.external || (!isNotes && !isComments) || !zip.file(rel.target)) continue;
    const xml = parseXml(await zip.file(rel.target)!.async('string'));
    if (isNotes) {
      notes = paragraphsText(xml.documentElement)
        .split('\n')
        .filter((line) => !/^\d+$/.test(line.trim()))
        .join('\n');
    } else {
      for (const body of Array.from(xml.getElementsByTagName('*')).filter(
        (e) => e.localName === 'txBody' || e.localName === 'text',
      ))
        if (body.textContent?.trim()) comments.push(paragraphsText(body) || body.textContent);
    }
  }
  return { notes, comments };
}

function backgroundOf(parts: (Part | undefined)[], theme: Theme) {
  const bg = parts.map((p) => p?.xml.getElementsByTagNameNS(P, 'bg')[0]).find(Boolean);
  const bgPr = child(bg, P, 'bgPr');
  return bgPr ? fillOf(bgPr, undefined, theme) : colourOf(child(bg, P, 'bgRef'), theme);
}

const showsMaster = (p: Part | undefined) =>
  p?.xml.documentElement.getAttribute('showMasterSp') !== '0';

const spTree = (p: Part) => p.xml.getElementsByTagNameNS(P, 'spTree')[0];

export async function readPptx(file: Blob): Promise<Deck> {
  const zip = await JSZip.loadAsync(file);
  await loadPresets();
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

  const media: Record<string, Blob> = {};
  const light: Record<string, boolean> = {};
  const slides: DeckSlide[] = [];

  for (const [i, slidePath] of order.entries()) {
    const slide = await part(slidePath);
    if (!slide) continue;
    const layout = await part(relOf(slide, 'slideLayout')?.target);
    const master = layout ? await part(relOf(layout, 'slideMaster')?.target) : undefined;
    const theme = await themeFor(master);
    const ctx: SlideContext = {
      zip,
      slideW,
      slideH,
      styles: {
        theme,
        txStyles: master?.xml.getElementsByTagNameNS(P, 'txStyles')[0],
        defaultTextStyle,
      },
      layout,
      master,
      media,
      light,
      shapes: [],
      images: [],
      diagrams: [],
      drawings: [],
      order: [],
    };
    if (master && showsMaster(layout) && showsMaster(slide))
      await walkTree(ctx, spTree(master), IDENTITY, master, true);
    if (layout && showsMaster(slide)) await walkTree(ctx, spTree(layout), IDENTITY, layout, true);
    await walkTree(ctx, spTree(slide), IDENTITY, slide, false);

    slides.push({
      number: i + 1,
      hidden: slide.xml.documentElement.getAttribute('show') === '0',
      background: backgroundOf([slide, layout, master], theme),
      diagrams: ctx.diagrams,
      shapes: ctx.shapes,
      images: ctx.images,
      drawings: ctx.drawings,
      order: ctx.order,
      ...(await readNotes(zip, slide)),
    });
  }

  return { widthPt: slideW / EMU_PER_PT, heightPt: slideH / EMU_PER_PT, slides, media };
}
