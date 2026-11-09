import { useState } from 'react';
import type { RevealBlock, RevealFace } from './doc';
import type { BlockContext } from './context';
import { usePeekReveal } from './revealPeek';
import { sanitizeHtml } from './sanitize';
import { borderCss, radiusCss, shadowCss } from './typography';

function Face({ face, className }: { face: RevealFace; className: string }) {
  return (
    <span className={className} style={{ background: face.fill }}>
      {face.src && <img className="cp-reveal-img" src={face.src} alt="" />}
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
  return (
    <button
      type="button"
      className={open ? 'cp-reveal cp-revealed' : 'cp-reveal'}
      aria-pressed={open}
      style={{
        ...radiusCss(block.radius, block.corners),
        ...borderCss(block.border),
        ...shadowCss(block.shadow, 'box'),
      }}
      onClick={() => !ctx.edit && setRevealed(true)}
    >
      <Face face={block.under} className="cp-reveal-face" />
      <Face face={block.cover} className="cp-reveal-face cp-reveal-cover" />
    </button>
  );
}
