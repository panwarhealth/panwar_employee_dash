import type { CourseDoc } from '@/course/doc';
import { stripTags } from '@/course/text';
import type { Deck, DeckSlide } from './pptx';

export const usedMedia = (deck: Deck) => [
  ...new Set(deck.slides.flatMap((s) => s.images.map((im) => im.media))),
];

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const slideLines = (s: DeckSlide) =>
  s.shapes
    .filter((sh) => !sh.fromLayout)
    .flatMap((sh) => sh.text.split('\n'))
    .map((t) => t.trim())
    .filter(Boolean);

export function deckOverlap(deck: Deck, doc: CourseDoc) {
  const course = squash(
    doc.pages
      .flatMap((p) => p.blocks.map((b) => stripTags(JSON.stringify(b).replace(/\\"/g, '"'))))
      .join(' '),
  );
  const slides = deck.slides.filter((s) => !s.hidden);
  const matched = slides.filter((s) => {
    const line = slideLines(s)
      .map(squash)
      .filter((t) => t.length >= 12 && !/["\\]/.test(t))
      .sort((a, b) => b.length - a.length)[0];
    return !!line && course.includes(line);
  }).length;
  return { slides: slides.length, matched };
}

export function deckReference(deck: Deck, urls: Record<string, string>, name: string): string {
  const slides = deck.slides.map((s) => {
    const pictures = s.images
      .filter((im) => urls[im.media])
      .map(
        (im) =>
          `  ${urls[im.media]} at x ${im.x}% y ${im.y}% w ${im.w}% h ${im.h}%${im.radius ? `, corner radius ${im.radius}` : ''}`,
      );
    return [
      `## Slide ${s.number}${s.hidden ? ' (hidden)' : ''}`,
      ...slideLines(s).map((t) => `  ${t}`),
      ...(s.notes ? ['Speaker notes:', ...s.notes.split('\n').map((t) => `  ${t}`)] : []),
      ...(s.comments.length
        ? ['Comments:', ...s.comments.map((c) => `  - ${c.replace(/\n/g, ' / ')}`)]
        : []),
      ...(pictures.length ? ['Pictures:', ...pictures] : []),
    ].join('\n');
  });
  return [
    `<attached_deck name="${name}">`,
    "The designer attached this PowerPoint for reference. It was NOT imported, so never rebuild or add pages from it. Match its slides to the course pages by their wording. Its comments are usually a reviewer's mark-ups: when asked, make those amends on the matching pages of the course. Its pictures are uploaded and ready to use as image src. Positions are % of the slide.",
    ...slides,
    '</attached_deck>',
  ].join('\n');
}
