import type { PageProblem } from '@/course/exportZip';
import { cn } from '@/lib/utils';

export function PageProblems({
  problems,
  selectedId,
  onSelect,
}: {
  problems: PageProblem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!problems.length) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-red-800">
        Export problems on this page ({problems.length})
      </h4>
      {problems.map((p) => (
        <div
          key={p.key}
          className={cn(
            'mt-2 rounded-lg bg-white p-2.5 text-xs text-ph-charcoal',
            p.blockId && p.blockId === selectedId && 'ring-2 ring-red-400',
          )}
        >
          <p>{p.text}</p>
          {p.blockId && (
            <button
              type="button"
              onClick={() => onSelect(p.blockId!)}
              className="mt-2 font-semibold text-red-700 hover:underline"
            >
              Show it
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
