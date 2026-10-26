import type { ReactNode } from 'react';
import type { Block, Frame, Layout, Page } from './doc';
import { BlockView, type BlockContext } from './blocks';
import { frameFor, frameStyle } from './canvasLayout';

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
          return renderObject ? (
            renderObject(b, frame, content)
          ) : (
            <div key={b.id} className="cp-obj" style={frameStyle(frame)}>
              {content}
            </div>
          );
        })}
        {overlay}
      </div>
    </div>
  );
}
