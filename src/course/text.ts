import type { Block } from './doc';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export const stripTags = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]);

export const htmlLines = (html: string) =>
  stripTags(html.replace(/<\/(p|li)>|<br\s*\/?>/g, '\n'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function blockText(b: Block): string {
  if (b.type === 'heading') return b.text;
  if (b.type === 'text' || b.type === 'scroll') return htmlLines(b.html).join('\n');
  return '';
}

export const hasText = (b: Block) => blockText(b).trim() !== '';
