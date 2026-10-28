import type { HeadingBlock, TextBlock, TextStyle } from '@/course/doc';
import { round1 } from '@/course/geometry';
import { BUILTIN_FONTS } from '@/course/typography';
import type { DeckPara, DeckRun, DeckShape } from './pptx';

interface Base {
  size: number;
  colour?: string;
  bold: boolean;
  font?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mostCommon<T>(values: { value: T; weight: number }[]): T | undefined {
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

function paraStyle(p: DeckPara, base: Base, align: string): string {
  const styles: string[] = [];
  if (p.align !== align) styles.push(`text-align: ${p.align}`);
  if (p.lineHeight) styles.push(`line-height: ${p.lineHeight}`);
  if (p.spaceBefore) styles.push(`margin-top: ${round1(p.spaceBefore / base.size)}em`);
  styles.push(`margin-bottom: ${p.spaceAfter ? round1(p.spaceAfter / base.size) : 0}em`);
  return ` style="${styles.join('; ')}"`;
}

function parasHtml(paras: DeckPara[], base: Base, align: string): string {
  const groups: { tag: 'p' | 'ul' | 'ol'; items: string[] }[] = [];
  for (const p of paras) {
    const style = paraStyle(p, base, align);
    const inner = p.runs.map((r) => runHtml(r, base)).join('') || '<br>';
    const tag = p.bullet === 'num' ? 'ol' : p.bullet ? 'ul' : 'p';
    const last = groups[groups.length - 1];
    if (tag === 'p') groups.push({ tag, items: [`<p${style}>${inner}</p>`] });
    else if (last?.tag === tag) last.items.push(`<li${style}>${inner}</li>`);
    else groups.push({ tag, items: [`<li${style}>${inner}</li>`] });
  }
  return groups
    .map((g) => (g.tag === 'p' ? g.items[0] : `<${g.tag}>${g.items.join('')}</${g.tag}>`))
    .join('');
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

function isUniform(paras: DeckPara[], base: Base): boolean {
  const runs = textRuns(paras);
  return (
    runs.length > 0 &&
    paras.filter((p) => textRuns([p]).length).length === 1 &&
    runs.every(
      (r) =>
        r.colour === base.colour &&
        Math.abs(r.size - base.size) < 0.5 &&
        !!r.bold === base.bold &&
        !r.baseline &&
        !r.italic &&
        !r.underline &&
        !r.link,
    )
  );
}

export function shapeBlock(
  shape: DeckShape,
  id: string,
  pxPerPt: number,
): HeadingBlock | TextBlock {
  const base = baseOf(shape.paras);
  const firstPara = shape.paras.find((p) => textRuns([p]).length);
  const align = firstPara?.align ?? 'left';
  const textStyle = textStyleOf(base, pxPerPt, firstPara?.lineHeight);
  const style = {
    fill: shape.fill,
    border: shape.border,
    radius: shape.radius ?? (shape.fill || shape.border ? 0 : undefined),
    corners: shape.corners,
    valign: shape.valign,
  };
  const title = shape.placeholder === 'title' || shape.placeholder === 'ctrTitle';
  if (title && isUniform(shape.paras, base))
    return {
      id,
      type: 'heading',
      text: textRuns(shape.paras)
        .map((r) => r.text)
        .join(''),
      level: 1,
      align,
      textStyle,
      ...style,
    };
  return {
    id,
    type: 'text',
    html: textRuns(shape.paras).length ? parasHtml(shape.paras, base, align) : '',
    align,
    textStyle,
    ...style,
  };
}
