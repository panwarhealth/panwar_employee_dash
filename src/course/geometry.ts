export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const round1 = (v: number) => Math.round(v * 10) / 10;

export const containsPoint = (outer: Box, x: number, y: number) =>
  x >= outer.x && x <= outer.x + outer.w && y >= outer.y && y <= outer.y + outer.h;

export const centreInside = (outer: Box, inner: Box) =>
  containsPoint(outer, inner.x + inner.w / 2, inner.y + inner.h / 2);

export function overlapShare(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(0.01, Math.min(a.w * a.h, b.w * b.h)) : 0;
}

export const overlaps = (a: Box, b: Box) => overlapShare(a, b) > 0;

export function bounds(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}

export const isBackdrop = (b: Box) => b.w >= 90 && b.h >= 85;

export const inFooterBand = (b: Box) => b.y >= 85;
