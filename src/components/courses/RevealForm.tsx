import { useEffect } from 'react';
import type { RevealBlock } from '@/course/doc';
import { BOXED_TEXT_PADDING } from '@/course/typography';
import { peekReveal, usePeekReveal } from '@/course/revealPeek';
import {
  Field,
  inputClass,
  MediaInput,
  NumberBox,
  PaddingField,
  RadiusField,
  sectionClass,
  Toggle,
} from './fields';
import { RichText } from './RichText';
import { BorderField, ColourField, ShadowField, TextStyleFields } from './TextStyleFields';

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
        <Field label="Picture size (% of the card, 100 fills it)">
          <NumberBox
            min={10}
            max={100}
            step={5}
            value={block[side].pictureSize ?? 100}
            onChange={(n) =>
              set((b) => {
                const size = Math.min(100, Math.max(10, n));
                if (size < 100) b[side].pictureSize = size;
                else delete b[side].pictureSize;
              })
            }
            className={inputClass}
          />
        </Field>
      )}
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
      <TextStyleFields
        value={block.textStyle}
        emphasis={false}
        colour={false}
        onChange={(v) => set((b) => (b.textStyle = v))}
      />
      <h4 className={sectionClass}>Box</h4>
      <PaddingField
        value={block.padding ?? BOXED_TEXT_PADDING}
        onChange={(v) => set((b) => (b.padding = v))}
      />
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
