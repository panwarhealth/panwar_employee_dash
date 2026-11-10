import type { CSSProperties } from 'react';
import type {
  Border,
  CourseDoc,
  Corners,
  Gradient,
  Insets,
  Shadow,
  TextStyle,
  VAlign,
} from './doc';

export const BUILTIN_FONTS: { id: string; label: string; css: string }[] = [
  { id: 'course', label: 'Course default', css: '' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { id: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', css: 'Tahoma, Verdana, sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', css: "'Trebuchet MS', Helvetica, sans-serif" },
  { id: 'segoe', label: 'Segoe UI', css: "'Segoe UI', system-ui, sans-serif" },
  { id: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  { id: 'times', label: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  { id: 'courier', label: 'Courier New', css: "'Courier New', monospace" },
  { id: 'impact', label: 'Impact', css: 'Impact, sans-serif' },
];

const safeName = (name: string) => name.replace(/[^A-Za-z0-9 _-]/g, '');

export function fontOptions(doc: CourseDoc): { id: string; label: string; css: string }[] {
  return [
    ...BUILTIN_FONTS,
    ...doc.fonts.map((f) => ({
      id: f.id,
      label: f.name,
      css: `'${safeName(f.name)}', sans-serif`,
    })),
  ];
}

export const fontCss = (doc: CourseDoc, id: string | undefined): string | undefined =>
  id ? fontOptions(doc).find((f) => f.id === id)?.css || undefined : undefined;

export function fontFaces(doc: CourseDoc): string {
  return doc.fonts
    .map(
      (f) =>
        `@font-face{font-family:'${safeName(f.name)}';src:url("${f.src.replace(/"/g, '')}");font-display:swap}`,
    )
    .join('');
}

export const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72];

const ROUNDED: Record<Corners, [number, number, number, number]> = {
  all: [1, 1, 1, 1],
  top: [1, 1, 0, 0],
  bottom: [0, 0, 1, 1],
  left: [1, 0, 0, 1],
  right: [0, 1, 1, 0],
};

export const px = (n: number) => `calc(${n} * var(--px, 1px))`;

export const radiusCss = (radius: number | undefined, corners: Corners = 'all'): CSSProperties =>
  radius === undefined
    ? {}
    : { borderRadius: ROUNDED[corners].map((on) => px(on * radius)).join(' ') };

export const gradientCss = (g: Gradient): string => {
  const stops = g.stops.map((s) => `${s.colour} ${s.at}%`).join(', ');
  return g.kind === 'radial'
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${g.angle}deg, ${stops})`;
};

export const paintCss = (fill: string | undefined, gradient?: Gradient): CSSProperties =>
  gradient ? { background: gradientCss(gradient) } : fill ? { background: fill } : {};

const shadowValue = (s: Shadow) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(s.colour.slice(i, i + 2), 16));
  return `${px(s.x)} ${px(s.y)} ${px(s.blur)} rgba(${r}, ${g}, ${b}, ${s.opacity})`;
};

export const shadowCss = (s: Shadow | undefined, on: 'box' | 'text' | 'image'): CSSProperties =>
  !s
    ? {}
    : on === 'box'
      ? { boxShadow: shadowValue(s) }
      : on === 'text'
        ? { textShadow: shadowValue(s) }
        : { filter: `drop-shadow(${shadowValue(s)})` };

export const borderCss = (border: Border | undefined): CSSProperties =>
  border ? { border: `${px(border.width)} solid ${border.colour}`, boxSizing: 'border-box' } : {};

export const BOX_PADDING: Insets = [3.6, 7.2, 3.6, 7.2];
export const BOXED_TEXT_PADDING: Insets = [20, 20, 20, 20];
export const BUTTON_MARGIN: Insets = [10, 0, 0, 0];
export const REVEAL_PADDING: Insets = [10, 10, 10, 10];
export const DEFAULT_LINE_HEIGHT = 1.3;

const JUSTIFY: Record<VAlign, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

export function boxCss(box: {
  fill?: string;
  gradient?: Gradient;
  shadow?: Shadow;
  radius?: number;
  corners?: Corners;
  border?: Border;
  valign?: VAlign;
  padding?: Insets;
}): CSSProperties {
  const filled = !!(box.fill || box.gradient);
  const valign = box.valign ?? (filled ? 'middle' : undefined);
  const padding = box.padding ?? (filled || box.border ? BOX_PADDING : undefined);
  return {
    ...paintCss(box.fill, box.gradient),
    ...shadowCss(box.shadow, filled || box.border ? 'box' : 'text'),
    ...(padding ? { padding: padding.map(px).join(' ') } : {}),
    ...(valign
      ? { display: 'flex', flexDirection: 'column', justifyContent: JUSTIFY[valign] }
      : {}),
    ...radiusCss(box.radius, box.corners),
    ...borderCss(box.border),
  };
}

export function textStyleCss(style: TextStyle | undefined, doc: CourseDoc): CSSProperties {
  if (!style) return {};
  return {
    fontFamily: fontCss(doc, style.font),
    fontSize: style.size ? `${style.size / 16}em` : undefined,
    color: style.color,
    fontWeight: style.weight,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: style.underline ? 'underline' : undefined,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing !== undefined ? `${style.letterSpacing}em` : undefined,
  };
}
