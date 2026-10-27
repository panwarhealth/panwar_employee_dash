import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { CourseDoc, Layout } from '@/course/doc';
import { Player } from '@/course/Player';
import { memoryLms, type Lms } from '@/course/scorm';
import { cn } from '@/lib/utils';

export function PreviewModal({
  doc,
  startPageId,
  layout,
  onClose,
}: {
  doc: CourseDoc;
  startPageId: string;
  layout: Layout;
  onClose: () => void;
}) {
  const lms = useMemo<Lms>(() => {
    const mem = memoryLms(null);
    return {
      ...mem,
      load: () => mem.load() ?? { v: 1, pageId: startPageId, visited: [], answers: {} },
    };
  }, [startPageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between text-sm text-white">
        <span>Preview - answers and progress are not saved</span>
        <button
          type="button"
          onClick={onClose}
          title="Close preview (Esc)"
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 font-semibold text-ph-charcoal shadow-md hover:bg-ph-purple hover:text-white"
        >
          <X className="h-4 w-4" />
          Close preview
        </button>
      </div>
      <div
        className={cn(
          'mx-auto w-full flex-1 overflow-y-auto rounded-md bg-white [&_.cp-shell]:min-h-full',
          layout === 'phone' ? 'max-w-[390px]' : 'max-w-[1100px]',
        )}
      >
        <Player doc={doc} lms={lms} layout={layout} />
      </div>
    </div>,
    document.body,
  );
}
