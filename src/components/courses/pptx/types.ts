import type { Gradient } from '@/course/doc';

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

export interface DeckShadow {
  colour: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
}

export interface DeckCell {
  table: string;
  row: number;
  rowSpan: number;
  gapT: number;
  gapB: number;
}

export type DeckVAlign = 'top' | 'middle' | 'bottom';

export interface DeckShape {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  text: string;
  paras: DeckPara[];
  valign: DeckVAlign;
  insets: [number, number, number, number];
  placeholder?: string;
  fromLayout?: boolean;
  glyph?: boolean;
  cell?: DeckCell;
  fill?: string;
  gradient?: Gradient;
  shadow?: DeckShadow;
  border?: DeckBorder;
  radius?: number;
  corners?: 'top';
  ellipse?: boolean;
}

export interface DeckImage {
  media: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  light: boolean;
  crop?: [number, number, number, number];
  radius?: number;
  border?: DeckBorder;
  shadow?: DeckShadow;
}

export interface DeckArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DeckDrawing {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  svg: string;
  shadow?: DeckShadow;
}

export interface DeckSlide {
  number: number;
  hidden: boolean;
  background?: string;
  backgroundGradient?: Gradient;
  diagrams: DeckArea[];
  shapes: DeckShape[];
  images: DeckImage[];
  drawings: DeckDrawing[];
  order: { kind: 'shape' | 'image' | 'drawing'; index: number; group?: number }[];
  notes: string;
  comments: string[];
}

export interface Deck {
  widthPt: number;
  heightPt: number;
  slides: DeckSlide[];
  media: Record<string, File>;
}
