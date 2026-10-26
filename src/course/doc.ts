export const SCHEMA_VERSION = 1;

export type Screens = 'both' | 'desktop' | 'phone';
export type Layout = 'desktop' | 'phone';

export interface CourseDoc {
  schemaVersion: number;
  title: string;
  screens: Screens;
  passMark: number | null;
  accent: string;
  pages: Page[];
}

export interface Page {
  id: string;
  title: string;
  kind: 'flow' | 'canvas';
  blocks: Block[];
  pick?: PickRule;
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
export type VisitedLook = 'none' | 'fade';

export type ClickAction = { kind: 'none' } | { kind: 'pick' } | ButtonAction;

export interface Interaction {
  hover: HoverLook;
  picked: PickedLook;
  visited: VisitedLook;
  onClick: ClickAction;
  correct: boolean;
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface BlockBase {
  id: string;
  frames?: Partial<Record<Layout, Frame>>;
  interact?: Interaction;
}

export interface HeadingBlock extends BlockBase {
  type: 'heading';
  text: string;
  level: 1 | 2;
  align: Align;
}

export interface TextBlock extends BlockBase {
  type: 'text';
  html: string;
  align: Align;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;
  fileName: string;
  alt: string;
  size: 'full' | 'medium' | 'small';
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

export interface ButtonBlock extends BlockBase {
  type: 'button';
  label: string;
  action: ButtonAction;
  style: 'solid' | 'outline';
  enabledWhen?: 'always' | 'picks';
}

export type ButtonAction =
  | { kind: 'next' }
  | { kind: 'page'; pageId: string }
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
}

export type Align = 'left' | 'center';

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | EmbedBlock
  | DividerBlock
  | ButtonBlock
  | CheckBlock;

export type BlockType = Block['type'];

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function newDoc(title: string, screens: Screens, passMark: number | null): CourseDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    title,
    screens,
    passMark,
    accent: '#702f8f',
    pages: [newPage('Welcome')],
  };
}

export function newPage(title: string): Page {
  return { id: uid(), title, kind: 'flow', blocks: [] };
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
        feedbackWrong: "Hmm, something doesn't seem quite right. Please try again.",
        required: true,
        scored: true,
      };
  }
}

export const isQuestion = (b: Block): b is CheckBlock => b.type === 'check';

export function scoredQuestions(doc: CourseDoc): CheckBlock[] {
  return doc.pages
    .flatMap((p) => p.blocks)
    .filter((b): b is CheckBlock => isQuestion(b) && b.scored);
}

export function moveItem<T>(list: T[], from: number, to: number): void {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

export const NO_INTERACTION: Interaction = {
  hover: 'none',
  picked: 'none',
  visited: 'none',
  onClick: { kind: 'none' },
  correct: false,
};

export const newPickRule = (): PickRule => ({
  needed: null,
  feedbackCorrect: "That's right!",
  feedbackWrong: "Hmm, something doesn't seem quite right. Please try again.",
  showAs: 'popup',
  required: true,
});

export const hasPicks = (page: Page) =>
  page.blocks.some((b) => b.interact?.onClick.kind === 'pick');
