import type { ReactNode } from 'react';
import type { Block, Frame, Layout, Page } from './doc';
import { BlockView, type BlockContext } from './blocks';
import { frameFor, frameStyle } from './canvasLayout';

function objectClass(block: Block, ctx: BlockContext): string {
  const i = block.interact;
  if (!i) return 'cp-obj';
  const picked = ctx.picked.includes(block.id);
  const clickable = block.type !== 'button' && i.onClick.kind !== 'none';
  const dimmed =
    !picked && i.onClick.kind === 'pick' && ctx.picked.length > 0 && i.picked === 'dim';
  return [
    'cp-obj',
    i.hover !== 'none' && `cp-hover-${i.hover}`,
    clickable && 'cp-click',
    picked && i.picked !== 'none' && i.picked !== 'dim' && `cp-picked-${i.picked}`,
    dimmed && 'cp-dim',
    i.visited === 'fade' && ctx.clicked.includes(block.id) && !picked && 'cp-visited',
  ]
    .filter(Boolean)
    .join(' ');
}

export function CanvasStage({
  page,
  layout,
  ctx,
  renderObject,
  overlay,
}: {
  page: Page;
  layout: Layout;
  ctx: BlockContext;
  renderObject?: (block: Block, frame: Frame, content: ReactNode) => ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <div className={`cp-stagewrap cp-stagewrap-${layout}`}>
      <div className={`cp-stage cp-stage-${layout}`}>
        {page.blocks.map((b) => {
          const frame = frameFor(page, b, layout);
          const content = <BlockView block={b} ctx={ctx} />;
          if (renderObject) return renderObject(b, frame, content);
          const clickable = b.type !== 'button' && (b.interact?.onClick.kind ?? 'none') !== 'none';
          return (
            <div
              key={b.id}
              className={objectClass(b, ctx)}
              style={frameStyle(frame)}
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
        {overlay}
      </div>
    </div>
  );
}
