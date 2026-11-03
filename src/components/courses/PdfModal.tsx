import { useState } from 'react';
import { downloadMedia } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { layoutsFor } from '@/course/canvasLayout';
import type { CourseDoc, Layout } from '@/course/doc';
import { slugify } from '@/course/exportZip';
import { cn, saveBlob } from '@/lib/utils';
import { coursePdf } from './coursePdf';

type Choice = Layout | 'both';

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'phone', label: 'Phone' },
  { value: 'both', label: 'Both (two PDFs)' },
];

export function PdfModal({
  open,
  onClose,
  courseId,
  doc,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  doc: CourseDoc;
}) {
  const layouts = layoutsFor(doc.screens);
  const [choice, setChoice] = useState<Choice>(layouts[0]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setProgress('Starting');
    try {
      for (const layout of choice === 'both' ? layouts : [choice]) {
        const blob = await coursePdf(
          doc,
          layout,
          (url) => downloadMedia(courseId, url),
          setProgress,
        );
        saveBlob(blob, `${slugify(doc.title)}-${layout}.pdf`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Export PDF" className="max-w-md">
      <div className="px-6 py-5">
        <p className="mb-5 text-sm text-ph-charcoal/60">
          Every page as the learner first sees it, with pop-ups, tabs, answers and feedback written
          out under it.
        </p>
        {layouts.length > 1 && (
          <div className="mb-5 flex gap-2">
            {CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChoice(c.value)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm',
                  choice === c.value
                    ? 'border-ph-purple bg-ph-purple/5 text-ph-purple'
                    : 'border-ph-charcoal/20 text-ph-charcoal hover:border-ph-purple',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <Button size="lg" disabled={progress !== null} onClick={() => void run()}>
          {progress ?? 'Download PDF'}
        </Button>
      </div>
    </Modal>
  );
}
