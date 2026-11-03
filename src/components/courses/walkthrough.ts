import type { Block, ButtonAction, CourseDoc, Page } from '@/course/doc';
import { blockText, htmlLines, stripTags } from '@/course/text';

export interface Detail {
  title: string;
  lines: string[];
}

const pageTitle = (doc: CourseDoc, pageId: string) =>
  doc.pages.find((p) => p.id === pageId)?.title ?? 'a missing page';

function labelOf(b: Block | undefined): string {
  if (!b) return 'an object';
  if (b.type === 'button' || b.type === 'popup') return `"${b.label}"`;
  const text = blockText(b).split('\n')[0];
  if (text) return `"${text.length > 60 ? `${text.slice(0, 57)}...` : text}"`;
  return b.type === 'image' && b.alt ? `the picture "${b.alt}"` : `the ${b.type}`;
}

function revealedBy(page: Page, blockId: string): string {
  const t = page.triggers.find(
    (t) =>
      (t.action.kind === 'show' || t.action.kind === 'popup') &&
      t.action.blockId === blockId &&
      t.when.kind === 'click',
  );
  const clicked = t?.when.kind === 'click' ? t.when.blockId : undefined;
  return clicked
    ? `Opens on a click on ${labelOf(page.blocks.find((b) => b.id === clicked))}`
    : 'Shown later on this page';
}

const goesTo = (doc: CourseDoc, a: ButtonAction) =>
  a.kind === 'next'
    ? 'the next page'
    : a.kind === 'page'
      ? `"${pageTitle(doc, a.pageId)}"${a.back ? ', then back here' : ''}`
      : a.url;

const feedback = (right: string, wrong: string) => [
  ...(right ? [`If right: ${stripTags(right)}`] : []),
  ...(wrong ? [`If wrong: ${stripTags(wrong)}`] : []),
];

const links = (html: string) =>
  [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(
    ([, href, text]) => `${stripTags(text)}: ${href}`,
  );

function blockDetail(doc: CourseDoc, page: Page, b: Block): Detail | null {
  switch (b.type) {
    case 'heading':
    case 'text':
    case 'image':
      if (!b.startHidden) return null;
      return {
        title: revealedBy(page, b.id),
        lines: b.type === 'image' ? [`Picture: ${b.alt || b.fileName}`] : blockText(b).split('\n'),
      };
    case 'button':
      return {
        title: `Button "${b.label}"`,
        lines: [`Goes to ${goesTo(doc, b.action)}`],
      };
    case 'popup':
      return {
        title: `Pop-up "${b.title}"`,
        lines: [
          revealedBy(page, b.id),
          ...htmlLines(b.html),
          ...(b.src ? [`Picture: ${b.fileName}`] : []),
        ],
      };
    case 'accordion':
    case 'tabs':
      return {
        title: b.type === 'tabs' ? 'Tabs' : 'Accordion',
        lines: b.items.flatMap((i) => [`${i.title}:`, ...htmlLines(i.html).map((l) => `   ${l}`)]),
      };
    case 'flip':
      return {
        title: 'Flip cards',
        lines: b.cards.map((c) => `${stripTags(c.front)} / back: ${stripTags(c.back)}`),
      };
    case 'hotspots':
      return {
        title: 'Hotspots',
        lines: b.spots.flatMap((s) => [`${s.title}:`, ...htmlLines(s.html).map((l) => `   ${l}`)]),
      };
    case 'pathway':
      return {
        title: 'Choice of path',
        lines: [
          b.prompt,
          ...b.choices.map((c) => `${c.label}: goes to "${pageTitle(doc, c.pageId)}"`),
        ],
      };
    case 'check':
      return {
        title: `Question${b.scored ? ' (scored)' : ''}${b.multiple ? ', pick all that apply' : ''}`,
        lines: [
          stripTags(b.question),
          ...b.options.map((o) => `   ${o.text}${o.correct ? '   (correct)' : ''}`),
          ...feedback(b.feedbackCorrect, b.feedbackWrong),
        ],
      };
    case 'drag': {
      const place = (id: string) =>
        b.targets.find((t) => t.id === id)?.label ?? b.groups.find((g) => g.id === id)?.label ?? '';
      return {
        title: `Drag and drop${b.scored ? ' (scored)' : ''}`,
        lines: [
          stripTags(b.prompt),
          ...(b.style === 'order'
            ? ['Correct order:', ...b.items.map((i, n) => `   ${n + 1}. ${i.text}`)]
            : b.items.map((i) => `   ${i.text}: ${place(i.target)}`)),
          ...feedback(b.feedbackCorrect, b.feedbackWrong),
        ],
      };
    }
    case 'match':
      return {
        title: `Matching${b.scored ? ' (scored)' : ''}`,
        lines: [
          stripTags(b.prompt),
          ...b.pairs.map((p) => `   ${p.left}: ${p.right}`),
          ...feedback(b.feedbackCorrect, b.feedbackWrong),
        ],
      };
    case 'blank':
      return {
        title: `Fill in the blanks${b.scored ? ' (scored)' : ''}, answers in [brackets]`,
        lines: [stripTags(b.prompt), b.text, ...feedback(b.feedbackCorrect, b.feedbackWrong)],
      };
    case 'slider':
      return {
        title: `Slider${b.scored ? ' (scored)' : ''}`,
        lines: [
          stripTags(b.prompt),
          `Answer: ${b.answer}${b.unit}${b.tolerance ? ` (give or take ${b.tolerance})` : ''}, range ${b.min} to ${b.max}`,
          ...feedback(b.feedbackCorrect, b.feedbackWrong),
        ],
      };
    case 'written':
      return { title: 'Written answer', lines: [stripTags(b.prompt)] };
    case 'likert':
      return {
        title: 'Rating scale',
        lines: [
          stripTags(b.prompt),
          ...b.rows.map((r) => `   ${r.text}`),
          `Scale: ${b.scale.join(', ')}`,
        ],
      };
    case 'results':
      return {
        title: 'Results',
        lines: [
          ...(doc.passMark !== null ? [`Pass mark: ${doc.passMark}%`] : []),
          `If passed: ${stripTags(b.passText)}`,
          `If failed: ${stripTags(b.failText)}`,
        ],
      };
    case 'video':
      return { title: 'Video', lines: [b.fileName || b.src] };
    case 'embed':
      return { title: 'Embedded content', lines: [b.url] };
    case 'audio':
      return {
        title: b.mode === 'narration' ? 'Narration' : 'Background audio',
        lines: [b.fileName],
      };
    default:
      return null;
  }
}

export function pageDetails(doc: CourseDoc, page: Page): Detail[] {
  const out = page.blocks.flatMap((b) => blockDetail(doc, page, b) ?? []);
  const linked = page.blocks.flatMap((b) =>
    b.type === 'text' || b.type === 'popup' ? links(b.html) : [],
  );
  return linked.length ? [...out, { title: 'Links', lines: linked }] : out;
}
