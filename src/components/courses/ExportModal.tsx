import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { downloadMedia, markExported } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { CourseDoc } from '@/course/doc';
import { buildZip, mediaUrls, plural, preflight, slugify } from '@/course/exportZip';
import { cn } from '@/lib/utils';

export function ExportModal({
  open,
  onClose,
  courseId,
  doc,
  onExported,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  doc: CourseDoc;
  onExported: () => void;
}) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checks = preflight(doc);
  const ready = checks.every((c) => c.ok);
  const media = mediaUrls(doc).length;
  const fileName = `${slugify(doc.title)}.zip`;

  const run = async () => {
    setError(null);
    setProgress('Fetching the course player');
    try {
      const { blob } = await buildZip(doc, (url) => downloadMedia(courseId, url), setProgress);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(href);
      await markExported(courseId);
      onExported();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Export SCORM zip" className="max-w-xl">
      <div className="px-6 py-5">
        <p className="mb-5 text-sm text-ph-charcoal/60">
          Upload the zip on the course's SCORM tab in Clinical Studio, or in any LMS that plays
          SCORM 1.2.
        </p>
        <ol className="mb-5 flex flex-col gap-3">
          {[
            ...checks,
            {
              ok: true,
              text: media ? `${plural(media, 'media file')} to bundle` : 'No media files',
            },
          ].map((c) => (
            <li key={c.text} className="flex items-start gap-3 text-sm text-ph-charcoal">
              <i
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
                  c.ok ? 'bg-green-700' : 'bg-red-700',
                )}
              >
                {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </i>
              <span className="pt-0.5">{c.text}</span>
            </li>
          ))}
        </ol>
        <div className="mb-5 rounded-md bg-ph-purple/5 px-4 py-3 font-mono text-[13px] leading-relaxed">
          {fileName}
          <br />
          <span className="text-ph-charcoal/60">
            imsmanifest.xml · index.html · course.json · media/
          </span>
        </div>
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-4">
          <Button size="lg" disabled={!ready || progress !== null} onClick={() => void run()}>
            {progress ?? 'Download zip'}
          </Button>
          {!ready && (
            <span className="text-sm text-ph-charcoal/60">Fix the items above first.</span>
          )}
        </div>
      </div>
    </Modal>
  );
}
