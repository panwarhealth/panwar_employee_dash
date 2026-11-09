import { useEffect } from 'react';
import type { RevealBlock } from '@/course/doc';
import { peekReveal, usePeekReveal } from '@/course/revealPeek';
import { MediaInput, RadiusField, sectionClass, Toggle } from './fields';
import { RichText } from './RichText';
import { BorderField, ColourField, ShadowField } from './TextStyleFields';

type Side = 'cover' | 'under';

export function RevealForm({
  block,
  courseId,
  set,
}: {
  block: RevealBlock;
  courseId: string;
  set: (fn: (b: RevealBlock) => void) => void;
}) {
  const peeking = usePeekReveal() === block.id;
  useEffect(() => () => peekReveal(null), [block.id]);

  const face = (side: Side, title: string) => (
    <>
      <h4 className={sectionClass}>{title}</h4>
      <RichText
        key={`${block.id}-${side}`}
        label="Text"
        boxStyled
        html={block[side].html}
        onChange={(v) => set((b) => (b[side].html = v))}
      />
      <MediaInput
        label="Picture (optional)"
        courseId={courseId}
        value={block[side].src}
        fileName={block[side].src ? 'Picture added' : ''}
        accept=".jpg,.jpeg,.png,.webp,.svg,.gif"
        onChange={(url) => set((b) => (b[side].src = url))}
      />
      {block[side].src && (
        <button
          type="button"
          onClick={() => set((b) => (b[side].src = ''))}
          className="self-start text-xs text-ph-purple underline underline-offset-2"
        >
          Remove picture
        </button>
      )}
      <ColourField
        label="Background colour"
        value={block[side].fill}
        onChange={(fill) => set((b) => (b[side].fill = fill))}
      />
    </>
  );

  return (
    <>
      <Toggle
        label="Show what's underneath on the canvas"
        checked={peeking}
        onChange={(on) => peekReveal(on ? block.id : null)}
      />
      {face('cover', 'Card on top')}
      {face('under', 'Underneath')}
      <h4 className={sectionClass}>Box</h4>
      <RadiusField
        value={block.radius}
        fallback={0}
        corners={block.corners}
        onChange={(radius, corners) =>
          set((b) => {
            b.radius = radius;
            b.corners = corners;
          })
        }
      />
      <BorderField value={block.border} onChange={(v) => set((b) => (b.border = v))} />
      <ShadowField value={block.shadow} onChange={(v) => set((b) => (b.shadow = v))} />
    </>
  );
}
