import { round1 } from '@/course/geometry';
import type { Gradient } from '@/course/doc';
import type { DeckBorder, DeckShadow } from './types';
import { A, child, EMU_PER_PT, num } from './xml';

export interface Theme {
  colours: Record<string, string>;
  majorFont?: string;
  minorFont?: string;
  lineWidths: number[];
  effects: (Element | undefined)[];
}

export function readTheme(themeXml: Document | undefined): Theme {
  const theme: Theme = { colours: {}, lineWidths: [], effects: [] };
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
  const effects = themeXml.getElementsByTagNameNS(A, 'effectStyleLst')[0];
  theme.effects = Array.from(effects?.children ?? []).map((e) => child(e, A, 'effectLst'));
  return theme;
}

export function themeFont(theme: Theme, typeface: string | null | undefined) {
  if (!typeface) return undefined;
  if (typeface.startsWith('+mj')) return theme.majorFont;
  if (typeface.startsWith('+mn')) return theme.minorFont;
  return typeface;
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

const PRESET_COLOURS: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  gray: '#808080',
  dkGray: '#A9A9A9',
  ltGray: '#D3D3D3',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
};

function colourParts(
  el: Element | undefined,
  theme: Theme,
): { hex: string; alpha: number } | undefined {
  const colour =
    child(el, A, 'srgbClr') ??
    child(el, A, 'schemeClr') ??
    child(el, A, 'sysClr') ??
    child(el, A, 'prstClr');
  if (!colour) return undefined;
  const val = colour.getAttribute('val') ?? '';
  let hex =
    colour.localName === 'srgbClr'
      ? `#${val}`
      : colour.localName === 'sysClr'
        ? `#${colour.getAttribute('lastClr') ?? '000000'}`
        : colour.localName === 'prstClr'
          ? PRESET_COLOURS[val]
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
  return { hex: hex.toUpperCase(), alpha: Math.round(alpha * 100) / 100 };
}

export function colourOf(el: Element | undefined, theme: Theme): string | undefined {
  const c = colourParts(el, theme);
  if (!c) return undefined;
  if (c.alpha >= 0.99) return c.hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${c.alpha})`;
}

export function gradientOf(spPr: Element | undefined, theme: Theme): Gradient | undefined {
  const grad = child(spPr, A, 'gradFill');
  if (!grad) return undefined;
  const stops = Array.from(grad.getElementsByTagNameNS(A, 'gs'))
    .flatMap((gs) => {
      const colour = colourOf(gs, theme);
      return colour ? [{ colour, at: Math.round(num(gs, 'pos') / 1000) }] : [];
    })
    .sort((a, b) => a.at - b.at);
  if (stops.length < 2) return undefined;
  const lin = child(grad, A, 'lin');
  return {
    kind: child(grad, A, 'path') ? 'radial' : 'linear',
    angle: Math.round(num(lin, 'ang') / 60000 + 90) % 360,
    stops,
  };
}

export function shadowOf(
  spPr: Element | undefined,
  style: Element | undefined,
  theme: Theme,
): DeckShadow | undefined {
  const ref = child(style, A, 'effectRef');
  const idx = ref ? num(ref, 'idx') : 0;
  return effectShadow(
    child(spPr, A, 'effectLst') ?? (idx > 0 ? theme.effects[idx - 1] : undefined),
    theme,
    ref,
  );
}

export function effectShadow(
  effects: Element | undefined,
  theme: Theme,
  ref?: Element,
): DeckShadow | undefined {
  const shadow = child(effects, A, 'outerShdw');
  const c = colourParts(shadow, theme) ?? colourParts(ref, theme);
  if (!shadow || !c || c.alpha < 0.01) return undefined;
  const dist = num(shadow, 'dist') / EMU_PER_PT;
  const dir = ((num(shadow, 'dir') / 60000) * Math.PI) / 180;
  return {
    colour: c.hex,
    opacity: c.alpha,
    x: round1(dist * Math.cos(dir)),
    y: round1(dist * Math.sin(dir)),
    blur: round1(num(shadow, 'blurRad') / EMU_PER_PT),
  };
}

export function fillOf(spPr: Element | undefined, style: Element | undefined, theme: Theme) {
  if (child(spPr, A, 'noFill')) return undefined;
  const solid = child(spPr, A, 'solidFill');
  if (solid) return colourOf(solid, theme);
  const grad = child(spPr, A, 'gradFill');
  if (grad) return colourOf(grad.getElementsByTagNameNS(A, 'gs')[0], theme);
  if (child(spPr, A, 'blipFill') || child(spPr, A, 'pattFill')) return undefined;
  const ref = child(style, A, 'fillRef');
  return ref && num(ref, 'idx') > 0 ? colourOf(ref, theme) : undefined;
}

export function borderOf(
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
