import type { CSSProperties } from 'react';
import type { CourseDoc, TextStyle, Corners } from './doc';

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

export const radiusCss = (radius: number | undefined, corners: Corners = 'all'): CSSProperties =>
  radius === undefined
    ? {}
    : { borderRadius: ROUNDED[corners].map((on) => `${(on * radius) / 16}em`).join(' ') };

export const boxCss = (
  fill: string | undefined,
  radius: number | undefined,
  corners?: Corners,
): CSSProperties => ({
  ...(fill
    ? {
        background: fill,
        padding: '0.4em 0.8em',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }
    : {}),
  ...radiusCss(radius, corners),
});

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
