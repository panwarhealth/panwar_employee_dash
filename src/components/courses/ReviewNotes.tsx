import type { Page } from '@/course/doc';
import { cn } from '@/lib/utils';

export function ReviewNotes({
  page,
  selectedId,
  onSelect,
  onResolve,
}: {
  page: Page;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onResolve: (noteId: string) => void;
}) {
  const notes = page.notes ?? [];
  if (!notes.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
        To check on this page ({notes.length})
      </h4>
      {notes.map((n) => {
        const target = n.blockId && page.blocks.some((b) => b.id === n.blockId) ? n.blockId : null;
        return (
          <div
            key={n.id}
            className={cn(
              'mt-2 rounded-lg bg-white p-2.5 text-xs text-ph-charcoal',
              target && target === selectedId && 'ring-2 ring-amber-400',
            )}
          >
            <p className="whitespace-pre-wrap">{n.text}</p>
            <div className="mt-2 flex gap-3">
              {target && (
                <button
                  type="button"
                  onClick={() => onSelect(target)}
                  className="font-semibold text-amber-700 hover:underline"
                >
                  Show it
                </button>
              )}
              <button
                type="button"
                onClick={() => onResolve(n.id)}
                className="font-semibold text-ph-purple hover:underline"
              >
                Mark fixed
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
