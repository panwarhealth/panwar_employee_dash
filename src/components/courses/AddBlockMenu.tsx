import type { BlockType } from '@/course/doc';
import { Modal } from '@/components/ui/modal';
import { BLOCKS } from './blockMeta';

const GROUPS = ['Content', 'Interactive', 'Questions'] as const;

export function AddBlockMenu({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: BlockType) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add a block" className="max-w-2xl">
      <div className="px-6 py-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g} className="contents">
              <div className="col-span-full mt-2 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
                {g}
              </div>
              {BLOCKS.filter((b) => b.group === g).map((b) => (
                <button
                  key={b.type}
                  type="button"
                  onClick={() => onPick(b.type)}
                  className="flex flex-col gap-1 rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-3 py-3 text-left text-sm font-semibold text-ph-charcoal hover:border-ph-purple hover:bg-ph-purple/5 hover:text-ph-purple"
                >
                  {b.name}
                  {b.detail && (
                    <small className="text-xs font-normal leading-snug text-ph-charcoal/60">
                      {b.detail}
                    </small>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
