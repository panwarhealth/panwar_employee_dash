import { blockText, stripTags } from '@/course/text';
import { groupsOf, type Block, type BlockType, type Page } from '@/course/doc';

export interface BlockMeta {
  type: BlockType;
  name: string;
  detail?: string;
  group: 'Content' | 'Interactive' | 'Questions';
}

export const BLOCKS: BlockMeta[] = [
  { type: 'heading', name: 'Heading', group: 'Content' },
  { type: 'text', name: 'Text', detail: 'Bold, links, lists', group: 'Content' },
  { type: 'image', name: 'Image', detail: 'jpg, png, svg, gif', group: 'Content' },
  { type: 'video', name: 'Video', detail: 'mp4 upload, captions', group: 'Content' },
  { type: 'embed', name: 'Embed', detail: 'YouTube, Vimeo, web page', group: 'Content' },
  { type: 'audio', name: 'Audio', detail: 'Narration with reveal cue points', group: 'Content' },
  { type: 'animation', name: 'Animation', detail: 'Lottie or GIF', group: 'Content' },
  { type: 'divider', name: 'Divider', group: 'Content' },
  { type: 'shape', name: 'Shape', detail: 'Box or circle, gradient, shadow', group: 'Content' },
  { type: 'popup', name: 'Pop-up', detail: 'Button that opens a layer', group: 'Interactive' },
  { type: 'accordion', name: 'Accordion', group: 'Interactive' },
  { type: 'tabs', name: 'Tabs', group: 'Interactive' },
  { type: 'flip', name: 'Flip cards', group: 'Interactive' },
  {
    type: 'reveal',
    name: 'Reveal card',
    detail: 'Click the card to uncover what is under it',
    group: 'Interactive',
  },
  {
    type: 'hotspots',
    name: 'Image hotspots',
    detail: 'Pins on a picture that open pop-ups',
    group: 'Interactive',
  },
  {
    type: 'button',
    name: 'Button',
    detail: 'Go to a page, open a link',
    group: 'Interactive',
  },
  { type: 'pathway', name: 'Pathway choice', detail: 'Branch to a page', group: 'Interactive' },
  {
    type: 'check',
    name: 'Knowledge check',
    detail: 'Single, multiple, true or false',
    group: 'Questions',
  },
  {
    type: 'drag',
    name: 'Drag and drop',
    detail: 'Order, drop on an image, sort into groups',
    group: 'Questions',
  },
  { type: 'match', name: 'Matching', detail: 'Pair items, drag or dropdown', group: 'Questions' },
  { type: 'blank', name: 'Fill in the blank', group: 'Questions' },
  { type: 'slider', name: 'Slider', detail: 'Pick a number on a scale', group: 'Questions' },
  {
    type: 'written',
    name: 'Written response',
    detail: 'Short answer or essay',
    group: 'Questions',
  },
  { type: 'likert', name: 'Likert scale', group: 'Questions' },
  {
    type: 'results',
    name: 'Results page',
    detail: 'Score, pass mark, retry, review',
    group: 'Questions',
  },
];

export const blockName = (type: BlockType) => BLOCKS.find((b) => b.type === type)?.name ?? type;

function labelText(b: Block): string {
  switch (b.type) {
    case 'heading':
    case 'text':
      return blockText(b).replace(/\s+/g, ' ');
    case 'image':
    case 'video':
    case 'audio':
    case 'animation':
    case 'hotspots':
      return b.fileName;
    case 'embed':
      return b.url;
    case 'button':
      return b.label;
    case 'popup':
      return b.title;
    case 'accordion':
    case 'tabs':
      return b.items.map((i) => i.title).join(', ');
    case 'flip':
      return b.cards.map((c) => c.front).join(', ');
    case 'reveal':
      return stripTags(b.cover.html).trim() || stripTags(b.under.html).trim();
    case 'check':
      return b.question;
    case 'pathway':
    case 'drag':
    case 'match':
    case 'blank':
    case 'slider':
    case 'written':
    case 'likert':
      return b.prompt;
    case 'divider':
    case 'shape':
    case 'results':
      return '';
  }
}

export const blockLabel = (b: Block): string =>
  b.name?.trim() ||
  labelText(b).replace(/\s+/g, ' ').trim() || blockName(b.type);

export const objectOptions = (page: Page): { value: string; label: string }[] => [
  ...groupsOf(page).map((g) => ({ value: g.id, label: `Group: ${g.name}` })),
  ...page.blocks.map((b) => ({ value: b.id, label: blockLabel(b).slice(0, 40) })),
];

export const objectLabel = (page: Page, id: string): string | undefined =>
  objectOptions(page).find((o) => o.value === id)?.label;
