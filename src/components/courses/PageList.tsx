import { Copy, Trash2 } from 'lucide-react';
import type { Page } from '@/course/doc';
import { cn } from '@/lib/utils';
import { SortableList } from './SortableList';

function pageTag(page: Page, last: boolean): string {
  if (page.kind === 'canvas') return 'canvas';
  if (page.blocks.some((b) => b.type === 'check')) return 'quiz';
  return last ? 'end' : '';
}

export function PageList({
  pages,
  currentId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  pages: Page[];
  currentId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-ph-charcoal/10 bg-[#faf9fb] px-3 py-4">
      <h4 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
        Pages
      </h4>
      <SortableList items={pages} onMove={onMove}>
        {(p, i) => {
          const on = p.id === currentId;
          const tag = pageTag(p, i === pages.length - 1);
          return (
            <div
              className={cn(
                'group flex w-full items-center gap-2 rounded-md border-[1.5px] px-2.5 py-2 text-sm',
                on
                  ? 'border-ph-purple bg-ph-purple/5 font-semibold text-ph-purple'
                  : 'border-transparent text-ph-charcoal hover:bg-ph-charcoal/5',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <em className="w-5 shrink-0 font-mono text-xs not-italic text-ph-charcoal/40">
                  {i + 1}
                </em>
                <span className="truncate">{p.title || 'Untitled'}</span>
              </button>
              {tag && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ph-charcoal/40 group-hover:hidden">
                  {tag}
                </span>
              )}
              <span className="hidden items-center gap-1 group-hover:flex">
                <button
                  type="button"
                  title="Duplicate page"
                  onClick={() => onDuplicate(p.id)}
                  className="text-ph-charcoal/50 hover:text-ph-purple"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    title="Delete page"
                    onClick={() => onDelete(p.id)}
                    className="text-ph-charcoal/50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
          );
        }}
      </SortableList>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-md border-[1.5px] border-dashed border-ph-charcoal/20 py-2 text-sm text-ph-charcoal/60 hover:border-ph-purple hover:text-ph-purple"
      >
        + Add page
      </button>
    </aside>
  );
}
