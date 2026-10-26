import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SortableList<T extends { id: string }>({
  items,
  onMove,
  children,
}: {
  items: T[];
  onMove: (from: number, to: number) => void;
  children: (item: T, index: number) => ReactNode;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => {
            setDragging(i);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            if (dragging === null) return;
            e.preventDefault();
            setOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== null && dragging !== i) onMove(dragging, i);
            setDragging(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          className={cn(
            'rounded-md',
            dragging === i && 'opacity-40',
            over === i && dragging !== null && dragging !== i && 'ring-2 ring-ph-purple/40',
          )}
        >
          {children(item, i)}
        </div>
      ))}
    </div>
  );
}
