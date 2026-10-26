import type { Block, BlockType } from '@/course/doc';

export interface BlockMeta {
  type: BlockType;
  name: string;
  detail?: string;
  group: 'Content' | 'Interactive' | 'Questions';
}

export const BLOCKS: BlockMeta[] = [
  { type: 'heading', name: 'Heading', group: 'Content' },
  {
    type: 'text',
    name: 'Text',
    detail: 'Bold, links, lists',
    group: 'Content',
  },
  {
    type: 'image',
    name: 'Image',
    detail: 'jpg, png, svg, gif',
    group: 'Content',
  },
  {
    type: 'video',
    name: 'Video',
    detail: 'mp4 upload, captions',
    group: 'Content',
  },
  {
    type: 'embed',
    name: 'Embed',
    detail: 'YouTube, Vimeo, web page',
    group: 'Content',
  },
  { type: 'divider', name: 'Divider', group: 'Content' },
  {
    type: 'button',
    name: 'Button',
    detail: 'Go to a page or open a link',
    group: 'Interactive',
  },
  {
    type: 'check',
    name: 'Knowledge check',
    detail: 'Single, multiple, true or false',
    group: 'Questions',
  },
];

export const blockName = (type: BlockType) => BLOCKS.find((b) => b.type === type)?.name ?? type;

export function blockLabel(b: Block): string {
  const text = (() => {
    switch (b.type) {
      case 'heading':
        return b.text;
      case 'text':
        return b.html.replace(/<[^>]+>/g, ' ');
      case 'image':
      case 'video':
        return b.fileName;
      case 'embed':
        return b.url;
      case 'button':
        return b.label;
      case 'check':
        return b.question;
      case 'divider':
        return '';
    }
  })();
  return text.replace(/\s+/g, ' ').trim() || blockName(b.type);
}
