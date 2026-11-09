export const SCHEMA_VERSION = 1;

export type Screens = 'both' | 'desktop' | 'phone';
export type Layout = 'desktop' | 'phone';

export interface CourseDoc {
  schemaVersion: number;
  title: string;
  screens: Screens;
  passMark: number | null;
  accent: string;
  navBar?: boolean;
  fonts: CourseFont[];
  variables: Variable[];
  pages: Page[];
}

export interface CourseFont {
  id: string;
  name: string;
  src: string;
  fileName: string;
}

export interface TextStyle {
  font?: string;
  size?: number;
  color?: string;
  weight?: 400 | 700;
  italic?: boolean;
  underline?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
}

export type VarType = 'boolean' | 'number' | 'text';

export interface Variable {
  id: string;
  name: string;
  type: VarType;
  initial: string;
}

export type Action =
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'page'; pageId: string; back?: boolean }
  | { kind: 'link'; url: string }
  | { kind: 'popup'; blockId: string }
  | { kind: 'closePopup' }
  | { kind: 'set'; varId: string; op: SetOp; value: string }
  | { kind: 'pick' }
  | { kind: 'show'; blockId: string }
  | { kind: 'hide'; blockId: string }
  | { kind: 'finish' };

export type SetOp = 'set' | 'add' | 'subtract' | 'toggle';

export type TriggerEvent =
  | { kind: 'click'; blockId: string }
  | { kind: 'pageStart' }
  | { kind: 'varChange'; varId: string }
  | { kind: 'mediaEnd'; blockId: string };

export type CompareOp = 'eq' | 'ne' | 'lt' | 'gt' | 'lte' | 'gte';

export interface Condition {
  id: string;
  join: 'and' | 'or';
  varId: string;
  op: CompareOp;
  value: string;
}

export interface Trigger {
  id: string;
  action: Action;
  when: TriggerEvent;
  conditions: Condition[];
}

export interface Page {
  id: string;
  title: string;
  blocks: Block[];
  triggers: Trigger[];
  pick?: PickRule;
  transition?: Transition;
  background?: string;
  gradient?: Gradient;
  looks?: Partial<Record<Layout, PageLook>>;
  notes?: ReviewNote[];
  groups?: Group[];
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  interact?: Interaction;
}

export interface ReviewNote {
  id: string;
  blockId?: string;
  text: string;
}

export type Transition = 'none' | 'fade' | 'slide';
export type AnimKind = 'none' | 'fade' | 'fadeUp' | 'slideLeft' | 'zoom';

export interface Anim {
  in: AnimKind;
  out: AnimKind;
  delay: number;
}

export interface PickRule {
  needed: number | null;
  feedbackCorrect: string;
  feedbackWrong: string;
  showAs: 'popup' | 'text';
  required: boolean;
}

export type HoverLook = 'none' | 'scale' | 'glow' | 'lift' | 'border';
export type PickedLook = 'none' | 'tick' | 'glow' | 'dim';
export type VisitedLook = 'none' | 'fade' | 'tick';

export interface Interaction {
  hover: HoverLook;
  picked: PickedLook;
  visited: VisitedLook;
  correct: boolean;
}

export type Corners = 'all' | 'top' | 'bottom' | 'left' | 'right';

export type Insets = [number, number, number, number];

export type Anchor = 'auto' | 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br';

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  a?: Anchor;
  s?: number;
}

export interface PageLook {
  background: string | null;
  gradient: Gradient | null;
}

export interface Border {
  colour: string;
  width: number;
}

export interface GradientStop {
  colour: string;
  at: number;
}

export interface Gradient {
  kind: 'linear' | 'radial';
  angle: number;
  stops: GradientStop[];
}

export interface Shadow {
  colour: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
}

export type VAlign = 'top' | 'middle' | 'bottom';

export interface BlockBase {
  id: string;
  name?: string;
  frames?: Partial<Record<Layout, Frame>>;
  looks?: Partial<Record<Layout, Record<string, unknown>>>;
  hidden?: boolean;
  interact?: Interaction;
  anim?: Anim;
  startHidden?: boolean;
}

export interface HeadingBlock extends BlockBase {
  type: 'heading';
  text: string;
  level: 1 | 2;
  align: Align;
  textStyle?: TextStyle;
  fill?: string;
  gradient?: Gradient;
  shadow?: Shadow;
  radius?: number;
  corners?: Corners;
  border?: Border;
  valign?: VAlign;
  padding?: Insets;
}

export interface TextBlock extends BlockBase {
  type: 'text';
  html: string;
  align: Align;
  textStyle?: TextStyle;
  fill?: string;
  gradient?: Gradient;
  shadow?: Shadow;
  radius?: number;
  corners?: Corners;
  border?: Border;
  valign?: VAlign;
  padding?: Insets;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;
  fileName: string;
  alt: string;
  size: 'full' | 'medium' | 'small';
  fill?: string;
  gradient?: Gradient;
  shadow?: Shadow;
  radius?: number;
  corners?: Corners;
  border?: Border;
  crop?: [number, number, number, number];
  stretch?: boolean;
  blur?: number;
}

export interface VideoBlock extends BlockBase {
  type: 'video';
  src: string;
  fileName: string;
  captions: string;
}

export interface EmbedBlock extends BlockBase {
  type: 'embed';
  url: string;
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
}

export interface ShapeBlock extends BlockBase {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  blur?: number;
  fill?: string;
  gradient?: Gradient;
  shadow?: Shadow;
  border?: Border;
  radius?: number;
  corners?: Corners;
}

export interface ButtonBlock extends BlockBase {
  type: 'button';
  label: string;
  action: ButtonAction;
  style: 'solid' | 'outline';
  fill?: string;
  gradient?: Gradient;
  shadow?: Shadow;
  radius?: number;
  corners?: Corners;
  textStyle?: TextStyle;
  enabledWhen?: 'always' | 'picks' | 'visited' | 'condition';
  enabledIf?: Condition[];
}

export type ButtonAction =
  | { kind: 'next' }
  | { kind: 'page'; pageId: string; back?: boolean }
  | { kind: 'link'; url: string };

export interface CheckOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface CheckBlock extends BlockBase {
  type: 'check';
  question: string;
  multiple: boolean;
  options: CheckOption[];
  shuffle: boolean;
  feedbackCorrect: string;
  feedbackWrong: string;
  required: boolean;
  scored: boolean;
  submitLabel?: string;
  look?: QuestionLook;
}

export interface AudioCue {
  id: string;
  at: number;
  blockId: string;
}

export interface AudioBlock extends BlockBase {
  type: 'audio';
  src: string;
  fileName: string;
  mode: 'narration' | 'background';
  cues: AudioCue[];
}

export interface AnimationBlock extends BlockBase {
  type: 'animation';
  src: string;
  fileName: string;
  loop: boolean;
}

export interface Panel {
  id: string;
  title: string;
  html: string;
}

export interface PopupBlock extends BlockBase {
  type: 'popup';
  label: string;
  title: string;
  html: string;
  src: string;
  fileName: string;
  showButton: boolean;
}

export interface AccordionBlock extends BlockBase {
  type: 'accordion';
  items: Panel[];
}

export interface TabsBlock extends BlockBase {
  type: 'tabs';
  items: Panel[];
}

export interface FlipCard {
  id: string;
  front: string;
  frontSrc: string;
  back: string;
}

export interface FlipBlock extends BlockBase {
  type: 'flip';
  cards: FlipCard[];
}

export interface RevealFace {
  html: string;
  src: string;
}

export interface RevealLook {
  coverFill?: string;
  underFill?: string;
  coverPictureSize?: number;
  underPictureSize?: number;
}

export interface RevealBlock extends BlockBase {
  type: 'reveal';
  cover: RevealFace;
  under: RevealFace;
  look?: RevealLook;
  textStyle?: TextStyle;
  padding?: Insets;
  radius?: number;
  corners?: Corners;
  border?: Border;
  shadow?: Shadow;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  title: string;
  html: string;
}

export interface HotspotBlock extends BlockBase {
  type: 'hotspots';
  src: string;
  fileName: string;
  alt: string;
  spots: Hotspot[];
}

export interface PathwayBlock extends BlockBase {
  type: 'pathway';
  prompt: string;
  choices: { id: string; label: string; pageId: string }[];
}

export interface QuestionLook {
  colour?: string;
  size?: number;
  answers?: 'list' | 'buttons';
  radius?: number;
  submitAlign?: 'left' | 'center' | 'right';
  card?: boolean;
  feedback?: 'under' | 'popup';
}

export interface QuestionBase extends BlockBase {
  feedbackCorrect: string;
  feedbackWrong: string;
  required: boolean;
  scored: boolean;
  submitLabel?: string;
  look?: QuestionLook;
}

export interface DragItem {
  id: string;
  text: string;
  target: string;
}

export interface DropTarget {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DragBlock extends QuestionBase {
  type: 'drag';
  style: 'order' | 'targets' | 'groups';
  prompt: string;
  items: DragItem[];
  targets: DropTarget[];
  groups: { id: string; label: string }[];
  src: string;
  fileName: string;
}

export interface MatchBlock extends QuestionBase {
  type: 'match';
  prompt: string;
  mode: 'drag' | 'dropdown';
  pairs: { id: string; left: string; right: string }[];
}

export interface BlankBlock extends QuestionBase {
  type: 'blank';
  prompt: string;
  text: string;
}

export interface SliderBlock extends QuestionBase {
  type: 'slider';
  prompt: string;
  min: number;
  max: number;
  step: number;
  answer: number;
  tolerance: number;
  unit: string;
}

export interface WrittenBlock extends BlockBase {
  type: 'written';
  prompt: string;
  length: 'short' | 'essay';
  required: boolean;
  saveTo?: string;
}

export interface LikertBlock extends BlockBase {
  type: 'likert';
  prompt: string;
  rows: { id: string; text: string }[];
  scale: string[];
  required: boolean;
}

export interface ResultsBlock extends BlockBase {
  type: 'results';
  passText: string;
  failText: string;
  retry: boolean;
  review: boolean;
  negative: boolean;
  pool: number | null;
}

export type Align = 'left' | 'center' | 'right' | 'justify';

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | EmbedBlock
  | DividerBlock
  | ShapeBlock
  | ButtonBlock
  | CheckBlock
  | AudioBlock
  | AnimationBlock
  | PopupBlock
  | AccordionBlock
  | TabsBlock
  | FlipBlock
  | RevealBlock
  | HotspotBlock
  | PathwayBlock
  | DragBlock
  | MatchBlock
  | BlankBlock
  | SliderBlock
  | WrittenBlock
  | LikertBlock
  | ResultsBlock;

export type GradedBlock = CheckBlock | DragBlock | MatchBlock | BlankBlock | SliderBlock;

export type BlockType = Block['type'];

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function newDoc(title: string, screens: Screens, passMark: number | null): CourseDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    title,
    screens,
    passMark,
    accent: '#702f8f',
    fonts: [],
    variables: [],
    pages: [newPage('Welcome')],
  };
}

export function newPage(title: string): Page {
  return { id: uid(), title, blocks: [], triggers: [] };
}

export function newBlock(type: BlockType): Block {
  const id = uid();
  switch (type) {
    case 'heading':
      return { id, type, text: 'Heading', level: 1, align: 'left' };
    case 'text':
      return { id, type, html: '<p>Type your text here.</p>', align: 'left' };
    case 'image':
      return { id, type, src: '', fileName: '', alt: '', size: 'full' };
    case 'video':
      return { id, type, src: '', fileName: '', captions: '' };
    case 'embed':
      return { id, type, url: '' };
    case 'divider':
      return { id, type };
    case 'shape':
      return { id, type, shape: 'rect', fill: '#E8E8E8' };
    case 'button':
      return {
        id,
        type,
        label: 'Continue',
        action: { kind: 'next' },
        style: 'solid',
      };
    case 'check':
      return {
        id,
        type,
        question: 'Type your question here',
        multiple: false,
        options: [
          { id: uid(), text: 'Correct answer', correct: true },
          { id: uid(), text: 'Wrong answer', correct: false },
        ],
        shuffle: true,
        feedbackCorrect: "That's right!",
        feedbackWrong: 'Not quite. Have another go.',
        required: true,
        scored: true,
      };
    case 'audio':
      return { id, type, src: '', fileName: '', mode: 'narration', cues: [] };
    case 'animation':
      return { id, type, src: '', fileName: '', loop: true };
    case 'popup':
      return {
        id,
        type,
        label: 'Learn more',
        title: 'More information',
        html: '<p>Type the pop-up content here.</p>',
        src: '',
        fileName: '',
        showButton: true,
      };
    case 'accordion':
      return { id, type, items: [panel(1), panel(2)] };
    case 'tabs':
      return { id, type, items: [panel(1), panel(2)] };
    case 'flip':
      return {
        id,
        type,
        cards: [
          { id: uid(), front: 'Front', frontSrc: '', back: 'Back' },
          { id: uid(), front: 'Front', frontSrc: '', back: 'Back' },
        ],
      };
    case 'reveal':
      return {
        id,
        type,
        cover: { html: '<p style="color: #FFFFFF">Click to reveal</p>', src: '' },
        under: { html: '<p>Type what the card reveals.</p>', src: '' },
        look: { coverFill: '#702F8F', underFill: '#FFFFFF' },
        radius: 12,
      };
    case 'hotspots':
      return { id, type, src: '', fileName: '', alt: '', spots: [] };
    case 'pathway':
      return {
        id,
        type,
        prompt: 'What would you do next?',
        choices: [
          { id: uid(), label: 'Option A', pageId: '' },
          { id: uid(), label: 'Option B', pageId: '' },
        ],
      };
    case 'drag':
      return {
        id,
        type,
        style: 'order',
        prompt: 'Put these in the right order.',
        items: [
          { id: uid(), text: 'First', target: '' },
          { id: uid(), text: 'Second', target: '' },
          { id: uid(), text: 'Third', target: '' },
        ],
        targets: [],
        groups: [
          { id: uid(), label: 'Group A' },
          { id: uid(), label: 'Group B' },
        ],
        src: '',
        fileName: '',
        feedbackCorrect: "That's right!",
        feedbackWrong: 'Not quite. Have another go.',
        required: true,
        scored: true,
      };
    case 'match':
      return {
        id,
        type,
        prompt: 'Match each item to its pair.',
        mode: 'drag',
        pairs: [
          { id: uid(), left: 'Item 1', right: 'Match 1' },
          { id: uid(), left: 'Item 2', right: 'Match 2' },
        ],
        feedbackCorrect: "That's right!",
        feedbackWrong: 'Not quite. Have another go.',
        required: true,
        scored: true,
      };
    case 'blank':
      return {
        id,
        type,
        prompt: 'Fill in the blanks.',
        text: 'The capital of Australia is [Canberra].',
        feedbackCorrect: "That's right!",
        feedbackWrong: 'Not quite. Have another go.',
        required: true,
        scored: true,
      };
    case 'slider':
      return {
        id,
        type,
        prompt: 'Move the slider to your answer.',
        min: 0,
        max: 100,
        step: 1,
        answer: 50,
        tolerance: 0,
        unit: '%',
        feedbackCorrect: "That's right!",
        feedbackWrong: 'Not quite. Have another go.',
        required: true,
        scored: true,
      };
    case 'written':
      return { id, type, prompt: 'Type your answer.', length: 'short', required: false };
    case 'likert':
      return {
        id,
        type,
        prompt: 'How much do you agree?',
        rows: [{ id: uid(), text: 'This course was useful' }],
        scale: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
        required: false,
      };
    case 'results':
      return {
        id,
        type,
        passText: 'Congratulations, you passed!',
        failText: "You didn't reach the pass mark this time.",
        retry: true,
        review: true,
        negative: false,
        pool: null,
      };
  }
}

const panel = (n: number) => ({
  id: uid(),
  title: `Section ${n}`,
  html: '<p>Type the content here.</p>',
});

export const isHiddenPopup = (b: Block) => b.type === 'popup' && !b.showButton;

export const withoutHidden = (doc: CourseDoc): CourseDoc => ({
  ...doc,
  pages: doc.pages.map((p) => ({ ...p, blocks: p.blocks.filter((b) => !b.hidden) })),
});

export const isQuestion = (b: Block): b is GradedBlock =>
  b.type === 'check' ||
  b.type === 'drag' ||
  b.type === 'match' ||
  b.type === 'blank' ||
  b.type === 'slider';

export function scoredQuestions(doc: CourseDoc): GradedBlock[] {
  return doc.pages
    .flatMap((p) => p.blocks)
    .filter((b): b is GradedBlock => isQuestion(b) && b.scored);
}

export function moveItem<T>(list: T[], from: number, to: number): void {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

export const NO_INTERACTION: Interaction = {
  hover: 'none',
  picked: 'tick',
  visited: 'none',
  correct: false,
};

const DESIGN_PX = { w: 960, h: 540 };

function emptyBoxToShape(b: TextBlock): ShapeBlock {
  const f = b.frames?.desktop;
  const w = f ? (f.w / 100) * DESIGN_PX.w : 0;
  const h = f ? (f.h / 100) * DESIGN_PX.h : 0;
  const circle =
    !!f && Math.abs(w - h) <= Math.max(w, h) * 0.03 && (b.radius ?? 0) >= Math.min(w, h) * 0.45;
  return {
    id: b.id,
    type: 'shape',
    shape: circle ? 'ellipse' : 'rect',
    ...(b.name ? { name: b.name } : {}),
    ...(b.frames ? { frames: b.frames } : {}),
    ...(b.interact ? { interact: b.interact } : {}),
    ...(b.anim ? { anim: b.anim } : {}),
    ...(b.startHidden ? { startHidden: true } : {}),
    ...(b.fill ? { fill: b.fill } : {}),
    ...(b.gradient ? { gradient: b.gradient } : {}),
    ...(b.shadow ? { shadow: b.shadow } : {}),
    ...(b.border ? { border: b.border } : {}),
    ...(!circle && b.radius !== undefined ? { radius: b.radius } : {}),
    ...(!circle && b.corners ? { corners: b.corners } : {}),
  };
}

const emptyHtml = (html: string) => !html.replace(/<[^>]*>|&nbsp;|\s/g, '');

const PARA_LINE_HEIGHT = /\s*line-height:\s*[\d.]+(em)?;?/g;

const PARAGRAPH_TAGS = new Set(['P', 'UL', 'OL', 'DIV']);

export function bakeTextColour(b: Block): void {
  if (b.type !== 'text' || !b.textStyle?.color) return;
  const { color, ...rest } = b.textStyle;
  b.textStyle = rest;
  const body = new DOMParser().parseFromString(`<body>${b.html}</body>`, 'text/html').body;
  let run: HTMLSpanElement | null = null;
  for (const node of [...body.childNodes]) {
    if (node instanceof HTMLElement && PARAGRAPH_TAGS.has(node.tagName)) {
      if (!node.style.color) node.style.color = color;
      run = null;
      continue;
    }
    if (!run) {
      run = body.ownerDocument.createElement('span');
      run.style.color = color;
      body.insertBefore(run, node);
    }
    run.appendChild(node);
  }
  b.html = body.innerHTML;
}

const PX_FONT = /font-size:\s*(\d+(?:\.\d+)?)px/g;

export function scalePxFonts<B extends Block>(b: B): B {
  const json = JSON.stringify(b);
  if (json.search(PX_FONT) < 0) return b;
  const base = ('textStyle' in b && b.textStyle?.size) || 16;
  const em = (_: string, n: string) => `font-size: ${Math.round((Number(n) / base) * 1000) / 1000}em`;
  return JSON.parse(json.replace(PX_FONT, em)) as B;
}

type OldFace = RevealFace & { fill?: string; pictureSize?: number };

function upgradeReveal(b: RevealBlock): RevealBlock {
  const cover = b.cover as OldFace;
  const under = b.under as OldFace;
  if (!('fill' in cover || 'pictureSize' in cover || 'fill' in under || 'pictureSize' in under))
    return b;
  const look: RevealLook = {
    coverFill: cover.fill,
    underFill: under.fill,
    coverPictureSize: cover.pictureSize,
    underPictureSize: under.pictureSize,
    ...b.look,
  };
  return {
    ...b,
    cover: { html: cover.html, src: cover.src },
    under: { html: under.html, src: under.src },
    look: JSON.parse(JSON.stringify(look)) as RevealLook,
  };
}

function upgradeBlock(stored: Block): Block {
  const original = scalePxFonts(stored);
  if (original.type === 'reveal') return upgradeReveal(original);
  const b = { ...original };
  bakeTextColour(b);
  if (b.type === 'text' && emptyHtml(b.html) && (b.fill || b.gradient || b.border))
    return emptyBoxToShape(b);
  if (b.type === 'text' && b.html.includes('line-height'))
    return { ...b, html: b.html.replace(PARA_LINE_HEIGHT, '').replace(/ style="\s*"/g, '') };
  if ((b as { type: string }).type !== 'scroll') return b;
  const text = { ...b, type: 'text', align: 'left' } as Block & { height?: number };
  delete text.height;
  return text;
}

function upgradePage(p: Page): Page {
  const page = { ...p, triggers: p.triggers ?? [], blocks: p.blocks.map(upgradeBlock) };
  delete (page as Page & { kind?: string }).kind;
  delete (page as Page & { sideways?: boolean }).sideways;
  return page;
}

const TYPED_NBSP = /&amp;nbsp;|&nbsp;/g;

export function fixNbsp(doc: CourseDoc): CourseDoc {
  const json = JSON.stringify(doc);
  if (!json.includes('nbsp;')) return doc;
  return JSON.parse(json.replace(TYPED_NBSP, '\u00a0')) as CourseDoc;
}

export function normalizeDoc(doc: CourseDoc): CourseDoc {
  return fixNbsp({
    ...doc,
    variables: doc.variables ?? [],
    fonts: doc.fonts ?? [],
    pages: doc.pages.map(upgradePage),
  });
}

export const pickIds = (page: Page): string[] =>
  page.triggers.flatMap((t) =>
    t.action.kind === 'pick' && t.when.kind === 'click' ? [t.when.blockId] : [],
  );

export const newPickRule = (): PickRule => ({
  needed: null,
  feedbackCorrect: "That's right!",
  feedbackWrong: 'Not quite. Have another go.',
  showAs: 'popup',
  required: true,
});

export const hasPicks = (page: Page) => pickIds(page).length > 0;

export function groupsOf(page: Page): Group[] {
  const ids = new Set(page.blocks.map((b) => b.id));
  return (page.groups ?? [])
    .map((g) => ({ ...g, members: g.members.filter((id) => ids.has(id)) }))
    .filter((g) => g.members.length > 1);
}

export const groupOf = (page: Page, blockId: string): Group | undefined =>
  groupsOf(page).find((g) => g.members.includes(blockId));

export const linkedPages = (page: Page): string[] =>
  [
    ...page.triggers.map((t) => t.action),
    ...page.blocks.flatMap((b) => (b.type === 'button' ? [b.action] : [])),
  ].flatMap((a) => (a.kind === 'page' && a.back ? [a.pageId] : []));
