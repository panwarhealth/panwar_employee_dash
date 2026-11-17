import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { downloadMedia, markExported } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { CourseDoc } from '@/course/doc';
import {
  buildZip,
  mediaUrls,
  plural,
  preflight,
  slugify,
  type Check as Finding,
} from '@/course/exportZip';
import { cn, saveBlob } from '@/lib/utils';

export function ExportModal({
  open,
  onClose,
  courseId,
  doc,
  onExported,
  onGoTo,
  onFix,
  fixing,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  doc: CourseDoc;
  onExported: () => void;
  onGoTo: (pageId: string) => void;
  onFix: (request: string) => void;
  fixing: boolean;
}) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checks = preflight(doc);
  const ready = checks.every((c) => c.ok);
  const media = mediaUrls(doc).length;
  const fileName = `${slugify(doc.title)}.zip`;
  const number = (id: string) => doc.pages.findIndex((p) => p.id === id) + 1;
  const shown: Finding[] = [
    ...checks,
    { ok: true, text: media ? `${plural(media, 'media file')} to bundle` : 'No media files' },
  ];
  const request = [
    'The export check found these problems. Fix them, and ask me first if a fix means deleting',
    'anything or guessing where a link should go.',
    ...checks
      .filter((c) => !c.ok)
      .map((c) => {
        const where = c.pages?.map((p) => `"${p.title}" (${p.id})`).join(', ');
        return `- ${c.text}${where ? ` Pages: ${where}` : ''}`;
      }),
  ].join('\n');

  const run = async () => {
    setError(null);
    setProgress('Fetching the course player');
    try {
      const { blob } = await buildZip(
        courseId,
        doc,
        (url) => downloadMedia(courseId, url),
        setProgress,
      );
      saveBlob(blob, fileName);
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
          {shown.map((c) => (
            <li key={c.text} className="flex items-start gap-3 text-sm text-ph-charcoal">
              <i
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
                  c.ok ? 'bg-green-700' : 'bg-red-700',
                )}
              >
                {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </i>
              <span className="pt-0.5">
                {c.text}
                {c.pages && (
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {c.pages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onGoTo(p.id);
                          onClose();
                        }}
                        className="text-ph-purple underline underline-offset-2"
                      >
                        {number(p.id)}. {p.title}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
        <div className="mb-5 rounded-md bg-ph-purple/5 px-4 py-3 font-mono text-[13px] leading-relaxed">
          {fileName}
          <br />
          <span className="text-ph-charcoal/60">
            imsmanifest.xml · index.html · course.json · fonts/ · media/
          </span>
        </div>
        {!ready && (
          <p className="mb-3 text-sm text-ph-charcoal/60">
            The zip will still download, with the problems above in it.
          </p>
        )}
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-4">
          <Button size="lg" disabled={progress !== null} onClick={() => void run()}>
            {progress ?? (ready ? 'Download zip' : 'Download anyway')}
          </Button>
          {!ready && (
            <Button
              size="lg"
              variant="outline"
              disabled={fixing || progress !== null}
              onClick={() => {
                onFix(request);
                onClose();
              }}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Fix with AI
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
