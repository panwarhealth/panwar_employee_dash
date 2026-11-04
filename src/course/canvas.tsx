import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { isHiddenPopup, type Block, type Frame, type Layout, type Page } from './doc';
import { BlockView } from './blocks';
import type { BlockContext } from './context';
import { frameFor, frameStyle, growsToFit } from './canvasLayout';
import { animClass, animStyle } from './anim';
import { centreInside } from './geometry';
import { paintCss } from './typography';

function objectClass(block: Block, ctx: BlockContext): string {
  const i = block.interact;
  const clickable = block.type !== 'button' && ctx.clickable.has(block.id);
  if (!i) return clickable ? 'cp-obj cp-click' : 'cp-obj';
  const picked = ctx.picked.includes(block.id);
  const dimmed = !picked && ctx.picked.length > 0 && i.picked === 'dim';
  return [
    'cp-obj',
    i.hover !== 'none' && `cp-hover-${i.hover}`,
    clickable && 'cp-click',
    picked && i.picked !== 'none' && i.picked !== 'dim' && `cp-picked-${i.picked}`,
    dimmed && 'cp-dim',
    i.visited !== 'none' && ctx.clicked.includes(block.id) && !picked && `cp-visited-${i.visited}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = outer?.firstElementChild as HTMLElement | null;
    const content = inner?.firstElementChild as HTMLElement | null;
    if (!outer || !inner || !content) return;
    const fit = () => {
      inner.style.height = '';
      inner.style.transform = '';
      const s = Math.min(
        outer.clientHeight / content.scrollHeight,
        outer.clientWidth / content.scrollWidth,
      );
      if (!(s < 0.99)) return;
      inner.style.height = `${100 / s}%`;
      inner.style.transform = `scale(${s})`;
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(outer);
    const mutate = new MutationObserver(fit);
    mutate.observe(content, { childList: true, subtree: true, characterData: true });
    content.addEventListener('load', fit, true);
    return () => {
      resize.disconnect();
      mutate.disconnect();
      content.removeEventListener('load', fit, true);
    };
  }, []);

  return (
    <div ref={box} className="cp-fit">
      <div className="cp-fit-in">{children}</div>
    </div>
  );
}

const decorative = (b: Block) =>
  b.type === 'image' || b.type === 'heading' || (b.type === 'text' && !/<a\s/i.test(b.html));

function clickThrough(page: Page, layout: Layout, clickable: Set<string>): Set<string> {
  const out = new Set<string>();
  page.blocks.forEach((b, i) => {
    if (clickable.has(b.id) || !decorative(b)) return;
    const f = frameFor(page, b, layout);
    const over = page.blocks
      .slice(0, i)
      .some((c) => clickable.has(c.id) && centreInside(frameFor(page, c, layout), f));
    if (over) out.add(b.id);
  });
  return out;
}

export function CanvasStage({
  page,
  layout,
  ctx,
  renderObject,
  overlay,
  hidden,
  leaving = false,
}: {
  page: Page;
  layout: Layout;
  ctx: BlockContext;
  renderObject?: (block: Block, frame: Frame, content: ReactNode) => ReactNode;
  overlay?: ReactNode;
  hidden?: Set<string>;
  leaving?: boolean;
}) {
  const throughTo = clickThrough(page, layout, ctx.clickable);
  return (
    <div className={`cp-stagewrap cp-stagewrap-${layout}`}>
      <div
        className={`cp-stage cp-stage-${layout}`}
        style={paintCss(page.background, page.gradient)}
      >
        {page.blocks.map((b) => {
          if (isHiddenPopup(b)) return <div key={b.id} className="cp-obj" hidden />;
          const frame = frameFor(page, b, layout);
          const view = <BlockView block={b} ctx={ctx} />;
          const content = growsToFit(b) ? view : <Fit>{view}</Fit>;
          if (renderObject) return renderObject(b, frame, content);
          const clickable = b.type !== 'button' && ctx.clickable.has(b.id);
          return (
            <div
              key={b.id}
              className={`${objectClass(b, ctx)} ${animClass(b, leaving, !!hidden?.has(b.id))}${throughTo.has(b.id) ? ' cp-through' : ''}`}
              style={{ ...frameStyle(frame, growsToFit(b)), ...animStyle(b) }}
              onClick={clickable ? () => ctx.click(b) : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) =>
                      (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ctx.click(b))
                  : undefined
              }
            >
              {content}
            </div>
          );
        })}
        {layout === 'phone' && page.sideways && (
          <div className="cp-sideways">Turn your phone sideways to read the diagram</div>
        )}
        {overlay}
      </div>
    </div>
  );
}
