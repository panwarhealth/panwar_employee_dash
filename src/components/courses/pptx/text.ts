import { round1 } from '@/course/geometry';
import { colourOf, themeFont, type Theme } from './theme';
import { isTitle, placeholderOf } from './placeholders';
import type { DeckAlign, DeckPara, DeckRun, DeckVAlign } from './types';
import { A, child, EMU_PER_PT, externalLink, num, P, type Part } from './xml';

export interface TextStyles {
  theme: Theme;
  txStyles?: Element;
  defaultTextStyle?: Element;
}

export interface DeckText {
  paras: DeckPara[];
  insets: [number, number, number, number];
  valign: DeckVAlign;
}

const ALIGN: Record<string, DeckAlign> = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
export const VALIGN: Record<string, DeckVAlign> = { t: 'top', ctr: 'middle', b: 'bottom' };

const firstAttr = (chain: (Element | undefined)[], name: string) =>
  chain.find((e) => e?.hasAttribute(name))?.getAttribute(name) ?? undefined;

const firstChild = (chain: (Element | undefined)[], names: string[]) => {
  for (const e of chain) {
    const found = names.map((n) => child(e, A, n)).find(Boolean);
    if (found) return found;
  }
  return undefined;
};

const flag = (value: string | undefined) => value === '1' || value === 'true' || undefined;

function readRun(
  r: Element,
  defRPrs: (Element | undefined)[],
  fontRef: Element | undefined,
  scale: number,
  styles: TextStyles,
  owner: Part,
): DeckRun {
  const rPr = child(r, A, 'rPr');
  const chain = [rPr, ...defRPrs];
  const solid = (e: Element | undefined) => colourOf(child(e, A, 'solidFill'), styles.theme);
  const colour =
    [rPr, defRPrs[0]].map(solid).find(Boolean) ??
    colourOf(fontRef, styles.theme) ??
    defRPrs.slice(1).map(solid).find(Boolean);
  return {
    text: child(r, A, 't')?.textContent ?? '',
    colour,
    size: round1((Number(firstAttr(chain, 'sz') ?? 1800) / 100) * scale),
    bold: flag(firstAttr(chain, 'b')),
    italic: flag(firstAttr(chain, 'i')),
    underline: (firstAttr(chain, 'u') ?? 'none') !== 'none' || undefined,
    strike: (firstAttr(chain, 'strike') ?? 'noStrike') !== 'noStrike' || undefined,
    baseline: Number(firstAttr(chain, 'baseline') ?? 0) / 1000 || undefined,
    font: themeFont(
      styles.theme,
      chain.map((c) => child(c, A, 'latin')?.getAttribute('typeface')).find(Boolean),
    ),
    highlight: colourOf(child(rPr, A, 'highlight'), styles.theme),
    link: externalLink(owner, child(rPr, A, 'hlinkClick')),
  };
}

function readSpacing(levelPrs: (Element | undefined)[], name: string) {
  const el = firstChild(levelPrs, [name]);
  const pct = child(el, A, 'spcPct');
  const pts = child(el, A, 'spcPts');
  if (pct) return { pct: num(pct, 'val') / 100000 };
  if (pts) return { pt: num(pts, 'val') / 100 };
  return undefined;
}

function readParagraph(
  p: Element,
  lstStyles: (Element | undefined)[],
  fontRef: Element | undefined,
  scale: number,
  styles: TextStyles,
  owner: Part,
): DeckPara {
  const pPr = child(p, A, 'pPr');
  const level = num(pPr, 'lvl');
  const levelPrs = [pPr, ...lstStyles.map((s) => child(s, A, `lvl${level + 1}pPr`))];
  const defRPrs = levelPrs.slice(1).map((l) => child(l, A, 'defRPr'));
  const runs: DeckRun[] = [];
  for (const r of Array.from(p.children)) {
    if (r.localName === 'br') runs.push({ text: '', br: true, size: 0 });
    else if (r.localName === 'r' || r.localName === 'fld')
      runs.push(readRun(r, defRPrs, fontRef, scale, styles, owner));
  }
  const bullet = firstChild(levelPrs, ['buNone', 'buChar', 'buAutoNum', 'buBlip'])?.localName;
  const firstSize = runs.find((r) => !r.br)?.size ?? 18;
  const lnSpc = readSpacing(levelPrs, 'lnSpc');
  const asPt = (s: { pct?: number; pt?: number } | undefined) =>
    s ? round1(s.pt ?? (s.pct ?? 0) * firstSize) : undefined;
  return {
    runs,
    align: ALIGN[firstAttr(levelPrs, 'algn') ?? 'l'] ?? 'left',
    level,
    bullet:
      bullet === 'buChar' || bullet === 'buBlip'
        ? 'dot'
        : bullet === 'buAutoNum'
          ? 'num'
          : undefined,
    lineHeight: lnSpc?.pct
      ? Math.round(lnSpc.pct * 1.2 * 100) / 100
      : lnSpc?.pt
        ? Math.round((lnSpc.pt / firstSize) * 100) / 100
        : undefined,
    spaceBefore: asPt(readSpacing(levelPrs, 'spcBef')) || undefined,
    spaceAfter: asPt(readSpacing(levelPrs, 'spcAft')) || undefined,
  };
}

export function readText(
  sp: Element,
  owner: Part,
  phChain: Element[],
  styles: TextStyles,
): DeckText {
  const ph = placeholderOf(sp);
  const txBody = child(sp, P, 'txBody') ?? child(sp, A, 'txBody');
  const section = !ph
    ? (child(styles.txStyles, P, 'otherStyle') ?? styles.defaultTextStyle)
    : child(styles.txStyles, P, isTitle(ph.type) ? 'titleStyle' : 'bodyStyle');
  const lstStyles = [
    child(txBody, A, 'lstStyle'),
    ...phChain.map((p) => child(child(p, P, 'txBody'), A, 'lstStyle')),
    section,
    ...(ph ? [] : [styles.defaultTextStyle]),
  ];
  const bodyPrs = [
    child(txBody, A, 'bodyPr'),
    ...phChain.map((p) => child(child(p, P, 'txBody'), A, 'bodyPr')),
  ];
  const inset = (name: string, fallback: number) =>
    Number(firstAttr(bodyPrs, name) ?? fallback) / EMU_PER_PT;
  const autofit = child(bodyPrs[0], A, 'normAutofit');
  const scale = autofit ? (num(autofit, 'fontScale') || 100000) / 100000 : 1;
  const fontRef = child(child(sp, P, 'style'), A, 'fontRef');
  return {
    paras: Array.from(txBody?.children ?? [])
      .filter((c) => c.localName === 'p')
      .map((p) => readParagraph(p, lstStyles, fontRef, scale, styles, owner)),
    insets: [
      inset('tIns', 45720),
      inset('rIns', 91440),
      inset('bIns', 45720),
      inset('lIns', 91440),
    ],
    valign: VALIGN[firstAttr(bodyPrs, 'anchor') ?? 't'] ?? 'top',
  };
}
