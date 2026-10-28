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
  cell?: DeckCell;
  fill?: string;
  border?: DeckBorder;
  radius?: number;
  corners?: 'top';
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
}

export interface DeckArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DeckSlide {
  number: number;
  hidden: boolean;
  background?: string;
  diagrams: DeckArea[];
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
