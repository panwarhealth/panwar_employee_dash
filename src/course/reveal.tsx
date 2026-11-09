import { useState } from 'react';
import type { RevealBlock, RevealFace } from './doc';
import type { BlockContext } from './context';
import { usePeekReveal } from './revealPeek';
import { sanitizeHtml } from './sanitize';
import { BOXED_TEXT_PADDING, borderCss, px, radiusCss, shadowCss } from './typography';

function Face({
  face,
  padding,
  className,
}: {
  face: RevealFace;
  padding: string;
  className: string;
}) {
  const size = face.pictureSize && face.pictureSize < 100 ? `${face.pictureSize}%` : null;
  return (
    <span className={className} style={{ background: face.fill, padding }}>
      {face.src && (
        <img
          className={size ? 'cp-reveal-img cp-reveal-img-fit' : 'cp-reveal-img'}
          style={size ? { maxWidth: size, maxHeight: size } : undefined}
          src={face.src}
          alt=""
        />
      )}
      {face.html && (
        <span
          className="cp-text cp-reveal-text"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(face.html) }}
        />
      )}
    </span>
  );
}

export function RevealView({ block, ctx }: { block: RevealBlock; ctx: BlockContext }) {
  const [revealed, setRevealed] = useState(false);
  const peek = usePeekReveal();
  const open = ctx.edit ? peek === block.id : revealed;
  const padding = (block.padding ?? BOXED_TEXT_PADDING).map(px).join(' ');
  return (
    <button
      type="button"
      className={open ? 'cp-reveal cp-revealed' : 'cp-reveal'}
      aria-pressed={open}
      style={{
        ...radiusCss(block.radius, block.corners),
        ...borderCss(block.border),
        ...shadowCss(block.shadow, 'box'),
        ...ctx.textStyle(block.textStyle),
      }}
      onClick={() => !ctx.edit && setRevealed(true)}
    >
      <Face face={block.under} padding={padding} className="cp-reveal-face" />
      <Face face={block.cover} padding={padding} className="cp-reveal-face cp-reveal-cover" />
    </button>
  );
}
