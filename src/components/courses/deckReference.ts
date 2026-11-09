import type { Deck } from './pptx';

export const usedMedia = (deck: Deck) => [
  ...new Set(deck.slides.flatMap((s) => s.images.map((im) => im.media))),
];

export function deckReference(deck: Deck, urls: Record<string, string>, name: string): string {
  const slides = deck.slides
    .filter((s) => s.images.some((im) => urls[im.media]))
    .map((s) => {
      const title = s.shapes.map((sh) => sh.text.trim()).find(Boolean)?.slice(0, 80) ?? '';
      const pictures = s.images
        .filter((im) => urls[im.media])
        .map(
          (im) =>
            `  ${urls[im.media]} at x ${im.x}% y ${im.y}% w ${im.w}% h ${im.h}%${im.radius ? `, corner radius ${im.radius}` : ''}`,
        );
      return [`Slide ${s.number}${s.hidden ? ' (hidden)' : ''}: ${title}`, ...pictures].join('\n');
    });
  return [
    `<attached_deck name="${name}">`,
    'The designer attached this PowerPoint for reference. It was NOT imported, so do not rebuild pages from it. Its pictures are uploaded and ready to use as image src. Positions are % of the slide.',
    ...slides,
    '</attached_deck>',
  ].join('\n');
}
