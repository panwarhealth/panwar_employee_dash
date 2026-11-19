import { useState } from 'react';
import {
  completePublish,
  createClinicalStudioCourse,
  downloadMedia,
  nextBuild,
  setClinicalStudioCourse,
  startPublish,
  type Course,
  type Difficulty,
  type PublishUpload,
} from '@/api/courses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { CourseDoc } from '@/course/doc';
import { packageFiles, preflight, type CheckSpot, type PackageFile } from '@/course/exportZip';
import { CheckList } from './ExportModal';

const TYPES: Record<string, string> = {
  html: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  vtt: 'text/vtt',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
};
const AT_ONCE = 6;
const TRIES = 3;

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

async function put(file: PackageFile, url: string): Promise<void> {
  const type = TYPES[file.path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'PUT',
      body: file.blob,
      headers: { 'Content-Type': type },
    }).catch(() => null);
    if (res?.ok) return;
    if (attempt === TRIES) throw new Error(`Could not upload ${file.path}. Try again.`);
  }
}

async function putAll(
  files: PackageFile[],
  urls: Record<string, string>,
  onSent: (sent: number) => void,
): Promise<void> {
  const queue = [...files];
  let sent = 0;
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const url = urls[file.path];
      if (!url) throw new Error(`Clinical Studio gave no upload address for ${file.path}`);
      await put(file, url);
      onSent(++sent);
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
}

export function PublishModal({
  onClose,
  courseId,
  doc,
  target,
  onTarget,
  onCreated,
  onExport,
  onGoTo,
  last,
  onPublished,
}: {
  onClose: () => void;
  courseId: string;
  doc: CourseDoc;
  target: string | null;
  onTarget: (course: Course) => void;
  onCreated: (clinicalStudioCourseId: string) => void;
  onExport: () => void;
  onGoTo: (spot: CheckSpot) => void;
  last: { build: number; version: number | null } | null;
  onPublished: (build: number, version: number | null) => void;
}) {
  const [id, setId] = useState(target ?? '');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{
    files: PackageFile[];
    upload: PublishUpload;
    build: number;
  } | null>(null);
  const [typed, setTyped] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState({
    title: doc.title,
    shortDescription: '',
    longDescription: '',
    difficulty: 'Beginner' as Difficulty,
  });
  const [done, setDone] = useState<{ build: number; version?: number } | null>(null);
  const problems = preflight(doc).filter((c) => !c.ok);
  const busy = progress !== null;

  const attempt = async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publishing failed');
    } finally {
      setProgress(null);
    }
  };

  const build = async () => {
    setProgress('Fetching the course player');
    const number = await nextBuild(courseId);
    const { files } = await packageFiles(
      courseId,
      doc,
      number,
      (url) => downloadMedia(courseId, url),
      setProgress,
    );
    setProgress('Checking with Clinical Studio');
    const upload = await startPublish(
      courseId,
      files.map((f) => f.path),
    );
    setReady({ files, upload, build: number });
  };

  const prepare = () =>
    attempt(async () => {
      setProgress('Saving the course ID');
      if (id.trim() !== (target ?? '')) onTarget(await setClinicalStudioCourse(courseId, id.trim()));
      await build();
    });

  const create = () =>
    attempt(async () => {
      setProgress('Creating the course in Clinical Studio');
      const made = await createClinicalStudioCourse(courseId, fresh);
      setId(made);
      setCreating(false);
      onCreated(made);
      await build();
    });

  const publish = () =>
    attempt(async () => {
      const { files, upload, build } = ready!;
      setProgress(`Uploading 0 of ${files.length}`);
      await putAll(files, upload.uploadUrls, (sent) =>
        setProgress(`Uploading ${sent} of ${files.length}`),
      ).catch((e: unknown) => {
        setReady(null);
        throw e;
      });
      setProgress('Switching the course over');
      const { version } = await completePublish(courseId, {
        uploadId: upload.uploadId,
        totalFiles: files.length,
        build,
        confirmCourseTitle: typed,
      });
      onPublished(build, version ?? null);
      setDone({ build, version });
    });

  const title = ready?.upload.courseTitle ?? '';
  const live = ready?.upload.isOnProduction ?? false;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Publish to Clinical Studio"
      className="max-w-lg"
    >
      <div className="space-y-4 px-6 py-5 text-sm text-ph-charcoal">
        {done ? (
          <>
            <p>
              Published build {done.build}
              {done.version !== undefined && ` as Clinical Studio v${done.version}`}.{' '}
              <strong>{title}</strong> now plays this build. Learners keep their progress.
            </p>
            <div className="flex justify-end">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        ) : ready ? (
          <>
            <p className="text-base">
              Publish to <strong>{title}</strong>?
            </p>
            {live ? (
              <div className="space-y-3 rounded-md bg-red-50 p-3 text-red-800">
                <p>
                  <strong>This course is live on Clinical Studio.</strong> Learners get this
                  version as soon as you publish.
                </p>
                <p>Type the course title to confirm:</p>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={title}
                  aria-label="Course title"
                  disabled={busy}
                  autoFocus
                />
              </div>
            ) : (
              <p className="text-ph-charcoal/60">
                This course is not live yet. Only the Clinical Studio staging site shows it.
              </p>
            )}
            {error && <p className="text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant={live ? 'destructive' : 'default'}
                disabled={busy || (live && oneLine(typed) !== title)}
                onClick={() => void publish()}
              >
                {progress ?? 'Publish'}
              </Button>
            </div>
          </>
        ) : creating ? (
          <>
            <p className="text-ph-charcoal/60">
              This creates a draft course in Clinical Studio and publishes this course into it.
              Learners can't see it until you make it live in Clinical Studio admin.
            </p>
            <label className="block">
              <span className="mb-1.5 block">Title</span>
              <Input
                value={fresh.title}
                onChange={(e) => setFresh({ ...fresh, title: e.target.value })}
                disabled={busy}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block">Short description</span>
              <Input
                value={fresh.shortDescription}
                onChange={(e) => setFresh({ ...fresh, shortDescription: e.target.value })}
                disabled={busy}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block">Long description</span>
              <textarea
                value={fresh.longDescription}
                onChange={(e) => setFresh({ ...fresh, longDescription: e.target.value })}
                disabled={busy}
                rows={4}
                className="w-full resize-y rounded-md border border-ph-charcoal/20 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ph-purple/40 disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block">Difficulty</span>
              <select
                value={fresh.difficulty}
                onChange={(e) => setFresh({ ...fresh, difficulty: e.target.value as Difficulty })}
                disabled={busy}
                className="h-9 w-full rounded-md border border-ph-charcoal/20 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ph-purple/40 disabled:opacity-50"
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>
            {error && <p className="text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" disabled={busy} onClick={() => setCreating(false)}>
                Back
              </Button>
              <Button
                disabled={
                  busy ||
                  !fresh.title.trim() ||
                  !fresh.shortDescription.trim() ||
                  !fresh.longDescription.trim()
                }
                onClick={() => void create()}
              >
                {progress ?? 'Create and continue'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-ph-charcoal/60">
              This replaces the content of a course that already exists in Clinical Studio.
              Learners keep their progress.
            </p>
            <div>
              <p className="mb-1.5">Clinical Studio course ID</p>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Paste the course ID from Clinical Studio"
                aria-label="Clinical Studio course ID"
                disabled={busy}
                autoFocus={!target}
              />
              {!target && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setCreating(true);
                  }}
                  className="mt-2 text-ph-purple underline underline-offset-2"
                >
                  No course in Clinical Studio yet? Create one
                </button>
              )}
            </div>
            {last && (
              <p className="text-ph-charcoal/60">
                Last published: build {last.build}
                {last.version !== null && `, Clinical Studio v${last.version}`}.
              </p>
            )}
            {problems.length > 0 && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="mb-2.5 text-ph-charcoal/70">
                  The export check found problems. They will be published as they are.
                </p>
                <CheckList
                  checks={problems}
                  doc={doc}
                  onGoTo={(spot) => {
                    onGoTo(spot);
                    onClose();
                  }}
                />
              </div>
            )}
            {error && <p className="text-red-700">{error}</p>}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={onExport}
                className="mr-auto text-ph-purple underline underline-offset-2"
              >
                Download a SCORM zip instead
              </button>
              <Button variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || !id.trim()} onClick={() => void prepare()}>
                {progress ?? 'Continue'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
