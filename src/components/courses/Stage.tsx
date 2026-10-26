import type { CourseDoc, Page } from '@/course/doc';
import { BlockView, type BlockContext } from '@/course/blocks';
import { accentStyle } from '@/course/util';
import { cn } from '@/lib/utils';
import { blockName } from './blockMeta';

const EDIT_CTX: BlockContext = {
  edit: true,
  answers: {},
  answer: () => {},
  next: () => {},
  goTo: () => {},
};

export function Stage({
  doc,
  page,
  phone,
  selectedId,
  onSelect,
}: {
  doc: CourseDoc;
  page: Page;
  phone: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-1 justify-center overflow-auto p-6" onClick={() => onSelect(null)}>
      <div
        className={cn(
          'cp flex min-h-[420px] w-full flex-col self-start rounded-md bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
          phone ? 'max-w-[390px]' : 'max-w-[760px]',
        )}
        style={accentStyle(doc)}
      >
        <div
          className={cn('cp-flow flex-1', phone ? 'px-[18px] py-[22px]' : 'px-[34px] py-[30px]')}
        >
          {page.blocks.length === 0 && (
            <div className="cp-empty">This page is empty. Add a block from the right.</div>
          )}
          {page.blocks.map((b) => (
            <div
              key={b.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(b.id);
              }}
              className={cn(
                'relative cursor-pointer rounded p-1.5 [&_*]:pointer-events-none',
                b.id === selectedId
                  ? 'ring-2 ring-ph-purple ring-offset-2'
                  : 'hover:ring-1 hover:ring-ph-purple/30 hover:ring-offset-2',
              )}
            >
              {b.id === selectedId && (
                <span className="absolute -top-5 left-0 bg-white px-1 text-[10px] font-semibold uppercase tracking-wider text-ph-purple">
                  {blockName(b.type)}
                </span>
              )}
              <BlockView block={b} ctx={EDIT_CTX} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
