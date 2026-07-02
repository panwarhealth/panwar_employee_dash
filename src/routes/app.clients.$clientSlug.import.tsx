import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/api/client';
import { useWorkspaceYear } from '@/lib/workspaceYear';
import { listPlacements, type PlacementListItem } from '@/api/placements';
import { listPublishers, listAudiences, type Publisher, type AudienceRow } from '@/api/taxonomy';
import { listEducationPages, type EducationPageSummary } from '@/api/education';
import {
  requestImportUploadUrl,
  startImportPreview,
  getImportJob,
  commitImport,
  type ImportPreview,
  type PlacementDiff,
  type EducationDiff,
  type ActualDiff,
  type CommitPlacement,
  type CommitEducation,
  type EducationValueDiff,
  type Outcome,
  type PlacementSuggestion,
  type SourceView,
} from '@/api/import';

export const Route = createFileRoute('/app/clients/$clientSlug/import')({
  component: ImportTab,
});

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS = 'application/vnd.ms-excel';
const CREATE = '__create__'; // target sentinel: create a new placement
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Decision = 'approve' | 'skip';

interface Upload {
  fileName: string;
  objectKey: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const OUTCOME_CELL: Record<Outcome, string> = {
  match: 'bg-emerald-50 border-emerald-200',
  change: 'bg-amber-50 border-amber-300',
  new: 'bg-sky-50 border-sky-300',
  invalid: 'bg-red-50 border-red-300',
};

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m]} ${y}` : iso;
}

function normalizeContentType(file: File): string {
  if (file.type === XLS || file.type === XLSX) return file.type;
  return file.name.toLowerCase().endsWith('.xls') ? XLS : XLSX;
}

const eduNeedsReview = (e: EducationDiff) => e.matchStatus !== 'matched';

function ImportTab() {
  const { clientSlug } = Route.useParams();
  const { year } = useWorkspaceYear();

  const { data: allPlacements = [] } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'placements', year],
    queryFn: () => listPlacements(clientSlug, { year }).then((r) => r.placements),
  });
  const { data: publishers = [] } = useQuery({
    queryKey: ['manage', 'publishers'],
    queryFn: listPublishers,
  });
  const { data: audiences = [] } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'audiences'],
    queryFn: () => listAudiences(clientSlug),
  });
  const { data: educationPages = [] } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'education-pages'],
    queryFn: () => listEducationPages(clientSlug),
  });

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [target, setTarget] = useState<Record<string, string>>({}); // key -> placementId | CREATE | ''(skip)
  const [decision, setDecision] = useState<Record<string, Decision>>({}); // key -> approve|skip (undefined = pending)
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sendDateEdits, setSendDateEdits] = useState<Record<string, string[]>>({}); // send key -> eDM send dates (ISO)
  const [createNames, setCreateNames] = useState<Record<string, string>>({}); // key -> name override for "create new placement"
  const [eduCreatePage, setEduCreatePage] = useState<Record<string, string>>({}); // education key -> pageId for "create new course"
  const [publisherOverride, setPublisherOverride] = useState<Record<string, string>>({}); // key -> publisher slug, when the file has none
  const [audienceOverride, setAudienceOverride] = useState<Record<string, string>>({}); // key -> audience slug, when the file has none
  const [acknowledged, setAcknowledged] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPreview(null);
    setPreviewError(null);
    for (const file of Array.from(list)) {
      const ct = normalizeContentType(file);
      setUploads((u) => [...u, { fileName: file.name, objectKey: '', status: 'uploading' }]);
      try {
        const { uploadUrl, objectKey } = await requestImportUploadUrl(clientSlug, { fileName: file.name, contentType: ct });
        const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': ct } });
        if (!put.ok) throw new Error('Upload to storage failed');
        setUploads((u) =>
          u.map((x) => (x.fileName === file.name && x.status === 'uploading' ? { ...x, objectKey, status: 'done' as const } : x)),
        );
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Upload failed';
        setUploads((u) =>
          u.map((x) => (x.fileName === file.name && x.status === 'uploading' ? { ...x, status: 'error' as const, error: msg } : x)),
        );
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  const doneFiles = () => uploads.filter((u) => u.status === 'done').map((u) => ({ objectKey: u.objectKey, fileName: u.fileName }));

  // Live progress: the backend reports its current step under this job id and we
  // poll it while the preview call is in flight.
  const jobIdRef = useRef<string>(crypto.randomUUID());
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  // The preview builds as a background job on the API (parse + all AI work), and we
  // poll until it's done - so the preview still arrives complete, with live status,
  // but no HTTP request has to stay open for minutes.
  const previewMutation = useMutation({
    mutationFn: async () => {
      jobIdRef.current = crypto.randomUUID();
      setProgressMsg(null);
      await startImportPreview(clientSlug, { year, files: doneFiles(), jobId: jobIdRef.current });
      const started = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        const job = await getImportJob(clientSlug, jobIdRef.current).catch(() => null);
        if (job?.message) setProgressMsg(job.message);
        if (job?.status === 'done' && job.preview) return job.preview;
        if (job?.status === 'failed') throw new Error(job.error ?? 'Preview failed');
        if (Date.now() - started > 15 * 60_000) throw new Error('The preview took too long - check the API is still running and try again.');
      }
    },
    onSuccess: (data) => {
      setPreview(data);
      setPreviewError(null);
      const t: Record<string, string> = {};
      const sd: Record<string, string[]> = {};
      data.placements.forEach((p, i) => {
        // Evidence picks the default: a real match pre-fills, anything else starts
        // unchosen so approving requires a conscious decision (no accidental creates).
        t[`p${i}`] = p.matchStatus === 'matched' && p.placementId ? p.placementId : '';
        // Each AI send gets its own destination, pre-filled with the AI's pick when it was confident.
        p.suggestions.forEach((s, si) => {
          t[`p${i}:s${si}`] = s.targetPlacementId ?? '';
          sd[`p${i}:s${si}`] = s.sendDates ?? [];
        });
      });
      data.education.forEach((e, i) => {
        t[`e${i}`] = e.matchStatus === 'matched' && e.assetId ? e.assetId : '';
      });
      setTarget(t);
      setSendDateEdits(sd);
      setCreateNames({});
      setEduCreatePage({});
      setDecision({});
      setEdits({});
      setPublisherOverride({});
      setAudienceOverride({});
      setAcknowledged(false);
    },
    onError: (e) => setPreviewError(e instanceof ApiError || e instanceof Error ? e.message : 'Preview failed'),
  });

  // A 1s elapsed ticker keeps the working card visibly alive between status updates
  // (the status itself arrives via the job poll inside the mutation).
  const previewPending = previewMutation.isPending;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!previewPending) return;
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [previewPending]);
  const elapsedLabel = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, '0')}s` : `${elapsed}s`;

  const isEdited = (k: string) => edits[k] !== undefined && edits[k] !== '';
  const effective = (k: string, fallback: number) => (isEdited(k) ? Number(edits[k]) : fallback);
  const pKey = (pi: number, r: ActualDiff) => `p${pi}:${r.metric}:${r.month}`;
  const eKey = (ei: number, r: EducationValueDiff) => `e${ei}:${r.status}:${r.year}:${r.month}`;

  const commitMutation = useMutation({
    mutationFn: () => {
      const sourceByKey = new Map(preview!.sources.map((s) => [s.objectKey, s]));
      const files = uploads
        .filter((u) => u.status === 'done')
        .map((u) => {
          const s = sourceByKey.get(u.objectKey);
          return { objectKey: u.objectKey, fileName: u.fileName, contentHash: s?.contentHash ?? null, formatId: s?.formatId ?? null };
        });

      const buildActuals = (i: number, rows: ActualDiff[], isMatched: boolean) =>
        rows
          .filter((r) => r.outcome !== 'invalid')
          .filter((r) => !isMatched || r.outcome !== 'match' || isEdited(pKey(i, r)))
          .map((r) => ({ year: preview!.year, month: r.month, metricKey: r.metric, value: effective(pKey(i, r), r.newValue), note: r.note }));

      const placements = preview!.placements.flatMap((p, i): CommitPlacement[] => {
        if (decision[`p${i}`] !== 'approve') return [];
        const publisher = p.publisher || publisherOverride[`p${i}`] || '';
        const audience = p.audience || audienceOverride[`p${i}`] || null;

        // AI card: one write per send, each to its own chosen destination. A send whose
        // numbers the AI pulled from the file (grounded values) saves those at the
        // send's REAL month - that's how "typed in the Feb row, actually sent in March"
        // lands in March. Sends without their own values fall back to the block's rows
        // for that month; only the first send of a month may claim them, so two
        // same-month sends can't write the same numbers twice.
        if (p.suggestions.length > 0) {
          return p.suggestions
            .map((s, si) => {
              const tgt = target[`p${i}:s${si}`] ?? '';
              if (!tgt) return null;
              const creating = tgt === CREATE;
              const isMatched = !creating && tgt === p.placementId;
              const firstForMonth = p.suggestions.findIndex((x) => x.month === s.month) === si;
              const actuals = s.values.length > 0
                ? s.values.map((v) => ({ year: preview!.year, month: s.month, metricKey: v.metric, value: v.value, note: null }))
                : firstForMonth
                  ? buildActuals(i, p.rows.filter((r) => r.month === s.month), isMatched)
                  : [];
              if (!actuals.length) return null;
              const sDates = sendDateEdits[`p${i}:s${si}`] ?? [];
              const cp: CommitPlacement = creating
                ? { source: p.source, parsedName: null, newPlacement: { brand: p.brand, publisher, audience, template: p.template, name: (createNames[`p${i}:s${si}`] ?? '').trim() || `${p.parsedName} - ${s.topicLabel}`, objective: p.objective }, actuals, sendDates: sDates }
                : { source: p.source, parsedName: null, placementId: tgt, actuals, sendDates: sDates };
              return cp;
            })
            .filter((x): x is CommitPlacement => x !== null);
        }

        // Plain card: one write for the whole block to the single chosen destination.
        // parsedName lets the backend remember the mapping for next month's import.
        const tgt = target[`p${i}`] ?? '';
        if (!tgt) return [];
        const creating = tgt === CREATE;
        const isMatched = !creating && tgt === p.placementId;
        const actuals = buildActuals(i, p.rows, isMatched);
        if (!actuals.length) return [];
        const sDates = sendDateEdits[`p${i}`] ?? [];
        return [
          creating
            ? { source: p.source, parsedName: null, newPlacement: { brand: p.brand, publisher, audience, template: p.template, name: (createNames[`p${i}`] ?? '').trim() || p.parsedName, objective: p.objective }, actuals, sendDates: sDates }
            : { source: p.source, parsedName: p.parsedName, placementId: tgt, actuals, sendDates: sDates },
        ];
      });

      const education = preview!.education
        .map((e, i): CommitEducation | null => {
          if (decision[`e${i}`] !== 'approve') return null;
          const tgt = target[`e${i}`] ?? '';
          if (!tgt) return null;
          const creating = tgt === CREATE;
          const pageId = eduCreatePage[`e${i}`] ?? (educationPages.length === 1 ? educationPages[0].id : '');
          if (creating && !pageId) return null;
          const isMatched = !creating && tgt === e.assetId;
          const values = e.rows
            .filter((r) => !isMatched || r.outcome !== 'match' || isEdited(eKey(i, r)))
            .map((r) => ({ status: r.status, year: r.year, month: r.month, value: effective(eKey(i, r), r.newValue) }));
          const expiry = edits[`e${i}:expiry`] ?? e.expiry ?? null;
          if (!values.length && !expiry) return null;
          return creating
            ? { assetId: null, values, expiry, newAsset: { pageId, group: e.group, brand: e.brand, type: e.type, title: e.title, author: e.author } }
            : { assetId: tgt, values, expiry };
        })
        .filter((x): x is CommitEducation => x !== null);

      return commitImport(clientSlug, { year: preview!.year, files, placements, education, acknowledged });
    },
  });

  // ── derive review state ────────────────────────────────────────────────────
  const items = useMemo(() => {
    if (!preview) return [] as { key: string; needsReview: boolean }[];
    return [
      ...preview.placements.map((p, i) => ({ key: `p${i}`, needsReview: p.needsReview })),
      ...preview.education.map((e, i) => ({ key: `e${i}`, needsReview: eduNeedsReview(e) })),
    ];
  }, [preview]);

  const cleanKeys = items.filter((it) => !it.needsReview).map((it) => it.key);
  const reviewKeys = items.filter((it) => it.needsReview).map((it) => it.key);
  const pendingCount = items.filter((it) => decision[it.key] === undefined).length;
  const cleanPending = cleanKeys.filter((k) => decision[k] === undefined).length;

  const approveAllClean = () =>
    setDecision((d) => {
      const next = { ...d };
      for (const k of cleanKeys) if (next[k] === undefined) next[k] = 'approve';
      return next;
    });

  const setItemDecision = (key: string, val: Decision) => setDecision((d) => ({ ...d, [key]: val }));

  const needsAck = !!preview?.sources.some((s) => s.alreadyImported);
  const hasDoneUploads = uploads.some((u) => u.status === 'done');
  const canCommit = pendingCount === 0 && (!needsAck || acknowledged) && !commitMutation.data;

  const aiTriggeredCount = preview ? preview.placements.filter((p) => p.needsReview && p.notes.length > 0).length : 0;
  const aiResolvedCount = preview ? preview.placements.filter((p) => p.suggestions.length > 0).length : 0;

  const cardProps = {
    target, setTarget, decision, setDecision: setItemDecision, edits, setEdits, sendDateEdits, setSendDateEdits, createNames, setCreateNames, eduCreatePage, setEduCreatePage, effective, pKey, eKey, allPlacements,
    publishers, audiences, educationPages, publisherOverride, setPublisherOverride, audienceOverride, setAudienceOverride,
  };

  // Split into two visible piles: the ones that need a look, and the ones that
  // already match a placement with nothing to decide.
  const pIdx = preview ? preview.placements.map((p, i) => ({ p, i })) : [];
  const eIdx = preview ? preview.education.map((e, i) => ({ e, i })) : [];
  const reviewP = pIdx.filter((x) => x.p.needsReview);
  const cleanP = pIdx.filter((x) => !x.p.needsReview);
  const reviewE = eIdx.filter((x) => eduNeedsReview(x.e));
  const cleanE = eIdx.filter((x) => !eduNeedsReview(x.e));

  return (
    <div className="flex flex-col gap-4">
      {/* ── Upload ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            <Button variant="outline" onClick={() => inputRef.current?.click()}>Choose files</Button>
            <span className="text-sm text-ph-charcoal/70">
              Upload this client's monthly publisher workbooks (.xlsx / .xls) for {year}. To import into a different year, change the year picker top-right first.
            </span>
          </div>

          {uploads.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {uploads.map((u, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-ph-charcoal">{u.fileName}</span>
                  {u.status === 'uploading' && <span className="text-ph-charcoal/50">uploading…</span>}
                  {u.status === 'done' && <span className="text-emerald-600">ready</span>}
                  {u.status === 'error' && <span className="text-red-600">{u.error}</span>}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => previewMutation.mutate()} disabled={!hasDoneUploads || previewMutation.isPending}>
              {previewMutation.isPending ? 'Working…' : 'Build preview'}
            </Button>
            {previewError && <span className="text-sm text-red-600">{previewError}</span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Working status: parse + AI runs before the preview appears ─────────── */}
      {previewMutation.isPending && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <span className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-ph-purple" />
            <div className="text-sm">
              <div className="font-medium text-ph-charcoal">Building preview… ({elapsedLabel})</div>
              <div className="text-ph-charcoal/70">{progressMsg ?? 'Getting started...'}</div>
              <div className="mt-1 text-xs text-ph-charcoal/50">
                Files with notes take longer because the AI reads them - the preview appears once everything is done.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {preview && !previewMutation.isPending && (
        <>
          <SummaryBar
            preview={preview}
            cleanCount={cleanKeys.length}
            reviewCount={reviewKeys.length}
            pendingCount={pendingCount}
            cleanPending={cleanPending}
            onApproveAllClean={approveAllClean}
            aiTriggeredCount={aiTriggeredCount}
            aiResolvedCount={aiResolvedCount}
          />

          {/* Pile 1: needs a human decision */}
          {reviewP.length + reviewE.length > 0 && (
            <div className="pt-1 text-sm font-semibold text-ph-charcoal">
              Need a look ({reviewP.length + reviewE.length})
            </div>
          )}
          {reviewP.map(({ p, i }) => <PlacementCard key={`p${i}`} pi={i} p={p} {...cardProps} />)}
          {reviewE.map(({ e, i }) => <EducationCard key={`e${i}`} ei={i} e={e} {...cardProps} />)}

          {/* Pile 2: already match a placement, nothing to decide */}
          {cleanP.length + cleanE.length > 0 && (
            <div className="pt-3 text-sm font-semibold text-ph-charcoal">
              Already match a placement - nothing to check ({cleanP.length + cleanE.length})
            </div>
          )}
          {cleanP.map(({ p, i }) => <PlacementCard key={`p${i}`} pi={i} p={p} {...cardProps} />)}
          {cleanE.map(({ e, i }) => <EducationCard key={`e${i}`} ei={i} e={e} {...cardProps} />)}

          {/* Commit */}
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              {needsAck && (
                <label className="flex items-center gap-2 text-sm text-amber-800">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                  One or more of these files was already imported - tick to import again.
                </label>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={() => commitMutation.mutate()} disabled={!canCommit || commitMutation.isPending}>
                  {commitMutation.isPending ? 'Committing…' : 'Commit import'}
                </Button>
                {pendingCount > 0 && <span className="text-sm text-ph-charcoal/60">{pendingCount} item{pendingCount === 1 ? '' : 's'} still need a decision</span>}
                {commitMutation.error && (
                  <span className="text-sm text-red-600">{commitMutation.error instanceof ApiError ? commitMutation.error.message : 'Commit failed'}</span>
                )}
                {commitMutation.data && (
                  <span className="text-sm text-emerald-600">
                    Wrote {commitMutation.data.valuesWritten} placement values across {commitMutation.data.placementsWritten} placements and{' '}
                    {commitMutation.data.educationValuesWritten} education values. Re-run the preview to confirm.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({
  preview,
  cleanCount,
  reviewCount,
  pendingCount,
  cleanPending,
  onApproveAllClean,
  aiTriggeredCount,
  aiResolvedCount,
}: {
  preview: ImportPreview;
  cleanCount: number;
  reviewCount: number;
  pendingCount: number;
  cleanPending: number;
  onApproveAllClean: () => void;
  aiTriggeredCount: number;
  aiResolvedCount: number;
}) {
  const h = preview.headline;
  const unmappedMetrics = useMemo(
    () => Array.from(new Set(preview.placements.flatMap((p) => p.rows.filter((r) => r.outcome === 'invalid').map((r) => prettyMetric(r.metric))))).sort(),
    [preview.placements],
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="text-sm font-semibold text-ph-charcoal">Here's what we found in your file{preview.sources.length > 1 ? 's' : ''}</div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill className="bg-emerald-100 text-emerald-800">{cleanCount} ready to go</Pill>
          <Pill className="bg-amber-100 text-amber-800">{reviewCount} need a look</Pill>
          {h.invalid > 0 && <Pill className="bg-red-100 text-red-800">{h.invalid} can't be saved</Pill>}
        </div>

        <div className="text-sm">
          {!preview.aiEnabled ? (
            <span className="text-ph-charcoal/50">The AI helper is turned off, so you'll match everything by hand below.</span>
          ) : aiTriggeredCount === 0 ? (
            <span className="text-ph-charcoal/50">Nothing in this file had notes for the AI to read, so match everything by hand below.</span>
          ) : aiResolvedCount > 0 ? (
            <span className="text-emerald-700">
              The AI read your file's notes and made suggestions for {aiResolvedCount} of {aiTriggeredCount} block{aiTriggeredCount > 1 ? 's' : ''} that needed a look. Check each one below.
            </span>
          ) : !preview.aiFailed ? (
            <span className="text-ph-charcoal/50">The AI read the notes but didn't come back with suggestions - match those blocks by hand below.</span>
          ) : null}
        </div>

        {preview.aiFailed && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-medium">The AI helper hit a problem partway through</div>
            <div className="mt-0.5">
              Some cards below may be missing its suggestions - you can still match them by hand. Or click
              "Build preview" again to retry; anything the AI already finished won't be re-done.
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {cleanPending > 0 && (
            <Button size="sm" onClick={onApproveAllClean}>
              Approve the {cleanPending} with nothing to check
            </Button>
          )}
          <span className="text-sm text-ph-charcoal/60">
            {pendingCount === 0 ? "You've reviewed everything - ready to save." : `${pendingCount} still need a yes/no from you`}
          </span>
        </div>

        {unmappedMetrics.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-medium">Some numbers can't be saved yet</div>
            <div className="mt-0.5">These types of number don't have anywhere to live in the system yet: {unmappedMetrics.join(', ')}. They're shown in red below. If you need them stored, give Rob a shout.</div>
          </div>
        )}

        <ul className="flex flex-col gap-1.5 text-xs">
          {preview.sources.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ph-charcoal">{s.file}</span>
              {s.alreadyImported && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                  already imported {new Date(s.alreadyImported.date).toLocaleDateString()}
                  {s.alreadyImported.by ? ` by ${s.alreadyImported.by}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── shared card chrome ────────────────────────────────────────────────────────

interface CardProps {
  target: Record<string, string>;
  setTarget: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  decision: Record<string, Decision>;
  setDecision: (key: string, val: Decision) => void;
  edits: Record<string, string>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  sendDateEdits: Record<string, string[]>;
  setSendDateEdits: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  createNames: Record<string, string>;
  setCreateNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  eduCreatePage: Record<string, string>;
  setEduCreatePage: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  educationPages: EducationPageSummary[];
  effective: (key: string, fallback: number) => number;
  pKey: (pi: number, r: ActualDiff) => string;
  eKey: (ei: number, r: EducationValueDiff) => string;
  allPlacements: PlacementListItem[];
  publishers: Publisher[];
  audiences: AudienceRow[];
  publisherOverride: Record<string, string>;
  setPublisherOverride: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  audienceOverride: Record<string, string>;
  setAudienceOverride: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function statusRing(decided: Decision | undefined, needsReview: boolean): string {
  if (decided === 'approve') return 'border-l-4 border-l-emerald-400';
  if (decided === 'skip') return 'border-l-4 border-l-ph-charcoal/30 opacity-60';
  return needsReview ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-200';
}

// The action bar that sits at the foot of every card, so the admin can read the
// whole card top-to-bottom and act without scrolling back up.
function DecisionBar({ decided, onApprove, onSkip, approveDisabled, approveHint, warnHint }: {
  decided: Decision | undefined;
  onApprove: () => void;
  onSkip: () => void;
  approveDisabled?: boolean;
  approveHint?: string;   // red: approve is blocked until this is sorted
  warnHint?: string;      // amber: approve works, but the user should know this
}) {
  if (decided === 'approve') {
    return (
      <div className="mt-1 flex items-center justify-end gap-3 border-t border-ph-charcoal/10 pt-3 text-sm text-emerald-700">
        <span className="font-semibold">Approved</span>
        <button className="underline underline-offset-2" onClick={onSkip}>change</button>
      </div>
    );
  }
  if (decided === 'skip') {
    return (
      <div className="mt-1 flex items-center justify-end gap-3 border-t border-ph-charcoal/10 pt-3 text-sm text-ph-charcoal/50">
        <span className="font-semibold">Skipped</span>
        <button className="underline underline-offset-2" onClick={onApprove}>undo</button>
      </div>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-3 border-t border-ph-charcoal/10 pt-3">
      {approveHint && <span className="text-xs text-red-600">{approveHint}</span>}
      {!approveHint && warnHint && <span className="text-xs text-amber-700">{warnHint}</span>}
      <Button variant="outline" className="px-5 py-2 text-base" onClick={onSkip}>Skip</Button>
      <Button className="px-6 py-2 text-base font-semibold" onClick={onApprove} disabled={approveDisabled}>Approve</Button>
    </div>
  );
}

// ── Source view: an Excel-style pane of the real cells, with sheet tabs ────────

function SourceViews({ views, file }: { views: SourceView[]; file: string }) {
  if (views.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {views.map((sv, si) => {
        const hasHighlight = sv.rows.some((r) => r.cells.some((c) => c.highlight));
        return (
          <div key={si} className="rounded-md border border-ph-charcoal/25 bg-white shadow-sm">
            {/* File name */}
            <div className="border-b border-ph-charcoal/15 bg-ph-charcoal/5 px-2 py-1 text-[11px] font-medium text-ph-charcoal/70">
              {file}
            </div>
            {/* Sheet tabs on top - the active one connects down into the grid */}
            {sv.tabs.length > 0 && (
              <div className="flex flex-wrap items-end gap-1 border-b border-ph-charcoal/20 bg-ph-charcoal/5 px-1.5 pt-1">
                {sv.tabs.map((t) => (
                  <span
                    key={t}
                    className={
                      t === sv.sheet
                        ? 'relative top-px rounded-t border border-b-0 border-ph-charcoal/25 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700'
                        : 'rounded-t px-2 py-0.5 text-[10px] text-ph-charcoal/45'
                    }
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {/* The cells - scrolls sideways for wide sheets (pb keeps the scrollbar off the last row) */}
            <div className="overflow-x-auto pb-3">
              <table className="border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="border border-ph-charcoal/15 bg-ph-charcoal/10 px-1.5 py-0.5" />
                    {(sv.rows[0]?.cells ?? []).map((c) => (
                      <th key={c.col} className="border border-ph-charcoal/15 bg-ph-charcoal/10 px-2 py-0.5 text-center font-normal text-ph-charcoal/50">{c.col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sv.rows.map((r) => (
                    <tr key={r.row}>
                      <td className="border border-ph-charcoal/15 bg-ph-charcoal/10 px-1.5 py-0.5 text-center text-ph-charcoal/50">{r.row}</td>
                      {r.cells.map((c, ci) => (
                        <td
                          key={ci}
                          className={`whitespace-nowrap border border-ph-charcoal/15 px-2 py-0.5 ${c.highlight ? 'bg-yellow-200 font-semibold text-ph-charcoal' : 'text-ph-charcoal/80'}`}
                        >
                          {c.value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasHighlight && (
              <div className="border-t border-ph-charcoal/10 px-2 py-1 text-[11px] text-ph-charcoal/50">The highlighted cells are what the AI used - the numbers, and the notes or dates that placed them.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Placement card ────────────────────────────────────────────────────────────

function PlacementCard({
  pi, p, target, setTarget, decision, setDecision, edits, setEdits, sendDateEdits, setSendDateEdits, createNames, setCreateNames, effective, pKey, allPlacements,
  publishers, audiences, publisherOverride, setPublisherOverride, audienceOverride, setAudienceOverride,
}: CardProps & { pi: number; p: PlacementDiff }) {
  const key = `p${pi}`;
  const tgt = target[key] ?? '';
  const decided = decision[key];
  const [showChooser, setShowChooser] = useState(false);

  const months = useMemo(() => Array.from(new Set(p.rows.map((r) => r.month))).sort((a, b) => a - b), [p.rows]);
  // When the AI moved a send to a month the file's rows never mention, relabel the
  // source column to the month it SAVES under (matched by the grounded values), so
  // the table shows Mar when the Feb-typed numbers are really the March send.
  const monthRelabel = useMemo(() => {
    const map = new Map<number, number>();
    const fileMonths = new Set(p.rows.map((r) => r.month));
    for (const s of p.suggestions) {
      if (s.values.length === 0 || fileMonths.has(s.month)) continue;
      const sources = months.filter((m) =>
        s.values.every((v) => p.rows.some((r) => r.month === m && r.metric === v.metric && r.newValue === v.value)));
      if (sources.length === 1 && !map.has(sources[0])) map.set(sources[0], s.month);
    }
    return map;
  }, [p.suggestions, p.rows, months]);
  const metrics = useMemo(() => Array.from(new Set(p.rows.map((r) => r.metric))), [p.rows]);
  const byCell = useMemo(() => {
    const m = new Map<string, ActualDiff>();
    for (const r of p.rows) m.set(`${r.metric}:${r.month}`, r);
    return m;
  }, [p.rows]);

  const effectivePublisher = p.publisher || publisherOverride[key] || '';
  const effectiveAudience = p.audience || audienceOverride[key] || '';
  const publisherName = publishers.find((x) => x.slug === effectivePublisher)?.name ?? effectivePublisher;
  const audienceName = audiences.find((x) => x.slug === effectiveAudience)?.name ?? effectiveAudience;
  const hasSuggestions = p.suggestions.length > 0;

  // A send can only save something if the AI pulled numbers for it, or the block has
  // numbers sitting in that send's month. Sends with neither are informational only.
  const sendHasData = (s: PlacementSuggestion) =>
    s.values.length > 0 || p.rows.some((r) => r.month === s.month && r.outcome !== 'invalid');
  const dataSendCount = p.suggestions.filter(sendHasData).length;
  const unresolvedDataSends = p.suggestions.filter((s, si) => sendHasData(s) && (target[`${key}:s${si}`] ?? '') === '').length;
  const anySendCreates = p.suggestions.some((_s, si) => (target[`${key}:s${si}`] ?? '') === CREATE);

  const creatingBlocked = hasSuggestions
    ? anySendCreates && (!effectivePublisher || !effectiveAudience)
    : tgt === CREATE && (!effectivePublisher || !effectiveAudience);
  const aiApproveBlocked = hasSuggestions && dataSendCount > 0 && unresolvedDataSends === dataSendCount;
  const approveDisabled = hasSuggestions ? (aiApproveBlocked || creatingBlocked) : (!tgt || creatingBlocked);
  const approveHintText = creatingBlocked
    ? 'pick the missing details above first'
    : aiApproveBlocked
      ? 'choose where at least one email goes first'
      : !hasSuggestions && !tgt
        ? 'choose where these numbers go first'
        : undefined;
  const warnHintText =
    hasSuggestions && !approveDisabled && unresolvedDataSends > 0
      ? `${unresolvedDataSends} email${unresolvedDataSends > 1 ? 's' : ''} above ${unresolvedDataSends > 1 ? 'have' : 'has'} no destination and won't be saved`
      : hasSuggestions && dataSendCount === 0
        ? 'nothing on this card has numbers to save yet'
        : undefined;

  return (
    <Card className={statusRing(decided, p.needsReview)}>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-ph-charcoal">{p.parsedName}</span>
            <span className="rounded border border-ph-purple/30 bg-ph-purple/10 px-2 py-0.5 text-[11px] font-medium text-ph-purple">
              {TEMPLATE_LABELS[p.template] ?? p.template}
            </span>
          </div>
          <div className="text-sm font-medium text-ph-charcoal/80">{p.brand}{publisherName ? ` · ${publisherName}` : ''}</div>
        </div>

        {/* Plain-English status first: matched banner, then why it needs a look */}
        {p.matchStatus === 'matched' && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {p.matchedByMemory ? (
              <>You put this in <span className="font-semibold">{p.matchedName}</span> last time, so it's matched there again.</>
            ) : (
              <>This already matches something you have: <span className="font-semibold">{p.matchedName}</span>.</>
            )}{' '}
            Any new or changed numbers below will be added to it.{' '}
            {!hasSuggestions && (
              <button
                className="underline underline-offset-2"
                onClick={() => {
                  if (showChooser && p.placementId) setTarget((m) => ({ ...m, [key]: p.placementId! }));
                  setShowChooser((v) => !v);
                }}
              >
                {showChooser ? 'keep it here' : 'change where it goes'}
              </button>
            )}
          </div>
        )}
        {p.needsReview && p.reviewReasons.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="font-semibold">Why this needs a look</div>
            <ul className="mt-0.5 list-disc pl-5">
              {p.reviewReasons.map((r, ri) => (
                <li key={ri}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* The notes the person wrote in the spreadsheet, one per line */}
        {p.notes.length > 0 && (
          <div className="rounded-md border border-ph-charcoal/10 bg-ph-charcoal/5 px-3 py-2 text-sm text-ph-charcoal/80">
            <div className="font-medium">{p.notes.length > 1 ? 'Notes in your file' : 'Note in your file'}</div>
            <ul className="mt-0.5 list-disc pl-5">
              {p.notes.map((n, ni) => (
                <li key={ni}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {/* The relevant patch of the spreadsheet */}
        <SourceViews views={p.sourceViews} file={p.source} />

        {/* What the AI worked out - plain English */}
        {p.suggestions.length > 0 && (
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm">
            <div className="font-semibold text-violet-900">What the AI worked out</div>
            <div className="mt-0.5 mb-2 text-xs text-violet-800/80">
              {dataSendCount > 0
                ? <>Based on the notes in your file, this looks like {dataSendCount} email{dataSendCount > 1 ? 's' : ''} with numbers to save. Here's where each one should go:</>
                : <>The notes name upcoming emails, but none of them have numbers in the file yet.</>}
            </div>
            <ul className="flex flex-col gap-2">
              {p.suggestions.map((s, si) => {
                if (!sendHasData(s)) return null;
                const sKey = `${key}:s${si}`;
                return (
                  <li key={si} className="rounded border border-violet-100 bg-white/70 px-2.5 py-2">
                    <div className="font-medium text-violet-900">{MONTHS[s.month]} - {s.topicLabel}</div>
                    {s.values.length > 0 && (
                      <div className="mt-0.5 text-[11px] text-violet-700/70">
                        Numbers found (checked against your file): {s.values.map((v) => `${fmt(v.value)} ${prettyMetric(v.metric).toLowerCase()}`).join(', ')}
                      </div>
                    )}
                    {s.reason && <div className="mt-0.5 text-[11px] text-violet-700/55">Why: {s.reason}</div>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-ph-charcoal/70">Save to:</span>
                        <TypeaheadTarget keyId={sKey} value={target[sKey] ?? ''} setTarget={setTarget} candidates={p.candidates} allPlacements={allPlacements} matchedName={s.targetName} canCreate emptyLabel="choose a placement" />
                        {s.targetName && <span className="text-[11px] text-ph-charcoal/45">the AI's suggestion</span>}
                        {(target[sKey] ?? '') !== '' &&
                          target[sKey] !== CREATE &&
                          p.suggestions.some((s2, si2) => sendHasData(s2) && (target[`${key}:s${si2}`] ?? '') !== target[sKey]) && (
                            <button
                              type="button"
                              className="text-[11px] text-violet-700 underline underline-offset-2"
                              onClick={() => {
                                const v = target[sKey]!;
                                setTarget((m) => {
                                  const next = { ...m };
                                  p.suggestions.forEach((s2, si2) => {
                                    if (sendHasData(s2)) next[`${key}:s${si2}`] = v;
                                  });
                                  return next;
                                });
                              }}
                            >
                              use this for all the emails on this card
                            </button>
                          )}
                    </div>
                    {target[sKey] === CREATE && (
                      <div className="mt-1.5">
                        <CreateSummary keyId={sKey} defaultName={`${p.parsedName} - ${s.topicLabel}`} matchHint={s.topicLabel} createNames={createNames} setCreateNames={setCreateNames} brand={p.brand} publisherName={publisherName} audienceName={audienceName} template={p.template} allPlacements={allPlacements} onUseExisting={(id) => setTarget((m) => ({ ...m, [sKey]: id }))} />
                      </div>
                    )}
                    {((sendDateEdits[sKey]?.length ?? 0) > 0 || p.template === 'Edm') && (
                      <SendDatesEditor sKey={sKey} dates={sendDateEdits[sKey] ?? []} setDates={setSendDateEdits} />
                    )}
                  </li>
                );
              })}
            </ul>
            {p.suggestions.some((s) => !sendHasData(s)) && (
              <div className={`text-xs text-violet-700/60 ${dataSendCount > 0 ? 'mt-2' : ''}`}>
                The notes also mention {p.suggestions.filter((s) => !sendHasData(s)).map((s) => `${MONTHS[s.month]} - ${s.topicLabel}`).join(', ')} - no numbers in the file for {p.suggestions.filter((s) => !sendHasData(s)).length > 1 ? 'those' : 'that one'} yet, so there's nothing to do.
              </div>
            )}
          </div>
        )}

        {!hasSuggestions && (p.matchStatus !== 'matched' || showChooser) && (
          <DestinationChooser
            keyId={key}
            value={tgt}
            setTarget={setTarget}
            candidates={p.candidates}
            allPlacements={allPlacements}
            createName={p.parsedName}
          />
        )}

        {!hasSuggestions && tgt === CREATE && (
          <CreateSummary keyId={key} defaultName={p.parsedName} matchHint={p.parsedName} createNames={createNames} setCreateNames={setCreateNames} brand={p.brand} publisherName={publisherName} audienceName={audienceName} template={p.template} allPlacements={allPlacements} onUseExisting={(id) => setTarget((m) => ({ ...m, [key]: id }))} />
        )}

        {creatingBlocked && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
            <span className="text-red-800">We need a couple more details before this can be created:</span>
            {!effectivePublisher && (
              <select
                className="h-8 rounded border border-red-300 bg-white px-1.5 text-sm"
                value={publisherOverride[key] ?? ''}
                onChange={(e) => setPublisherOverride((m) => ({ ...m, [key]: e.target.value }))}
              >
                <option value="">choose the publisher…</option>
                {publishers.map((pub) => (
                  <option key={pub.slug} value={pub.slug}>{pub.name}</option>
                ))}
              </select>
            )}
            {!effectiveAudience && (
              <select
                className="h-8 rounded border border-red-300 bg-white px-1.5 text-sm"
                value={audienceOverride[key] ?? ''}
                onChange={(e) => setAudienceOverride((m) => ({ ...m, [key]: e.target.value }))}
              >
                <option value="">choose the audience…</option>
                {audiences.map((a) => (
                  <option key={a.slug} value={a.slug}>{a.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Plain eDM blocks (no AI card) still need somewhere to enter the send dates. */}
        {!hasSuggestions && p.template === 'Edm' && (
          <SendDatesEditor sKey={key} dates={sendDateEdits[key] ?? []} setDates={setSendDateEdits} />
        )}

        {/* The numbers - always shown, nothing hidden */}
        <div>
          <div className="mb-1 text-xs font-medium text-ph-charcoal/70">
            {hasSuggestions
              ? 'The numbers in this block (what saves is set per email above)'
              : "The numbers we'll save"}
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-ph-charcoal/60">What</th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-1 text-right font-medium text-ph-charcoal/60">{MONTHS[monthRelabel.get(m) ?? m]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric}>
                    <td className="px-2 py-1 text-ph-charcoal">{prettyMetric(metric)}</td>
                    {months.map((m) => {
                      const c = byCell.get(`${metric}:${m}`);
                      return (
                        <td key={m} className="px-1 py-1">
                          {c ? (
                            <DiffCell
                              outcome={c.outcome}
                              oldValue={c.oldValue}
                              value={effective(pKey(pi, c), c.newValue)}
                              disabled={c.outcome === 'invalid' || monthRelabel.has(m)}
                              edited={edits[pKey(pi, c)]}
                              onChange={(v) => setEdits((e) => ({ ...e, [pKey(pi, c)]: v }))}
                            />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DiffLegend />
        </div>

        <DecisionBar
          decided={decided}
          onApprove={() => setDecision(key, 'approve')}
          onSkip={() => setDecision(key, 'skip')}
          approveDisabled={approveDisabled}
          approveHint={approveDisabled ? approveHintText : undefined}
          warnHint={warnHintText}
        />
      </CardContent>
    </Card>
  );
}

// "unique_opens" -> "Unique Opens"
function prettyMetric(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// ── Education card ────────────────────────────────────────────────────────────

function EducationCard({ ei, e, target, setTarget, decision, setDecision, edits, setEdits, eduCreatePage, setEduCreatePage, educationPages, effective, eKey }: CardProps & { ei: number; e: EducationDiff }) {
  const key = `e${ei}`;
  const tgt = target[key] ?? '';
  const decided = decision[key];

  const eduOptions = e.candidates.map((c) => ({ id: c.assetId, label: `${c.title} (${c.pageName})` }));
  const creating = tgt === CREATE;
  // With one education page there's nothing to choose - pick it automatically.
  const chosenPage = eduCreatePage[key] ?? (educationPages.length === 1 ? educationPages[0].id : '');
  const approveDisabled = !tgt || (creating && !chosenPage);

  return (
    <Card className={statusRing(decided, eduNeedsReview(e))}>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div>
          <div className="text-base font-semibold text-ph-charcoal">{e.title}</div>
          <div className="text-sm font-medium text-ph-charcoal/80">{e.brand}{e.type ? ` · ${e.type}` : ''} · education</div>
        </div>

        {e.matchStatus === 'matched' ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            This already matches: <span className="font-semibold">{e.pageName}</span>. The numbers below will be added to it.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="text-sm text-amber-800">
              {e.matchStatus === 'ambiguous' ? 'This matches more than one course - pick the right one.' : "This doesn't match a course yet - pick where it goes, or skip it."}
            </div>
            <select className="h-8 max-w-md rounded-md border border-ph-charcoal/20 bg-white px-2 text-sm" value={tgt} onChange={(ev) => setTarget((m) => ({ ...m, [key]: ev.target.value }))}>
              <option value="">Skip this one for now</option>
              {eduOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
              <option value={CREATE}>None of these - add it as a new course</option>
            </select>
            {creating && (
              <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
                <div className="text-xs font-semibold text-sky-900">This adds a new course when you save:</div>
                <div className="text-sm text-ph-charcoal">{e.title}</div>
                <div className="text-[11px] text-ph-charcoal/55">
                  {[e.group, e.brand, e.type, e.author].filter(Boolean).join(' · ')}
                </div>
                {educationPages.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ph-charcoal/60">On page:</span>
                    <select
                      className="h-8 max-w-xs rounded-md border border-sky-300 bg-white px-2 text-sm"
                      value={chosenPage}
                      onChange={(ev) => setEduCreatePage((m) => ({ ...m, [key]: ev.target.value }))}
                    >
                      <option value="">pick a page…</option>
                      {educationPages.map((pg) => (
                        <option key={pg.id} value={pg.id}>{pg.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {educationPages.length === 1 && (
                  <div className="text-[11px] text-ph-charcoal/55">Goes on the {educationPages[0].name} page.</div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ph-charcoal/70">Expiry date:</span>
          <input
            type="date"
            value={edits[`${key}:expiry`] ?? e.expiry ?? ''}
            onChange={(ev) => setEdits((s) => ({ ...s, [`${key}:expiry`]: ev.target.value }))}
            className="h-7 rounded border border-ph-charcoal/20 bg-white px-1.5 text-xs text-ph-charcoal"
          />
          {!(edits[`${key}:expiry`] ?? e.expiry) && <span className="text-[11px] text-ph-charcoal/45">none in the file - add one if you know it</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-medium text-ph-charcoal/60">What</th>
                <th className="px-2 py-1 text-left font-medium text-ph-charcoal/60">When</th>
                <th className="px-2 py-1 text-right font-medium text-ph-charcoal/60">Number</th>
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1 text-ph-charcoal">{r.status}</td>
                  <td className="px-2 py-1 text-ph-charcoal/70">{MONTHS[r.month]} {r.year}</td>
                  <td className="px-1 py-1">
                    <DiffCell
                      outcome={r.outcome}
                      oldValue={r.oldValue}
                      value={effective(eKey(ei, r), r.newValue)}
                      edited={edits[eKey(ei, r)]}
                      onChange={(v) => setEdits((s) => ({ ...s, [eKey(ei, r)]: v }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <DiffLegend />
        </div>

        <DecisionBar
          decided={decided}
          onApprove={() => setDecision(key, 'approve')}
          onSkip={() => setDecision(key, 'skip')}
          approveDisabled={approveDisabled}
          approveHint={!tgt ? 'choose where it goes first' : creating && !chosenPage ? 'pick which page it goes on' : undefined}
        />
      </CardContent>
    </Card>
  );
}

// ── Colour legend: says what approving DOES to each cell, in the cell's colour ──

function DiffLegend() {
  const chip = 'rounded border px-1 py-px';
  return (
    <details className="mt-1.5 text-[11px] text-ph-charcoal/60">
      <summary className="w-fit cursor-pointer select-none text-ph-charcoal/45 underline-offset-2 hover:text-ph-charcoal hover:underline">
        What do the colours mean?
      </summary>
      <div className="mt-1 leading-relaxed">
        When you approve:{' '}
        <span className={`${chip} border-emerald-200 bg-emerald-50 text-emerald-900`}>green</span> is already saved - nothing changes ·{' '}
        <span className={`${chip} border-sky-300 bg-sky-50 text-sky-900`}>blue</span> is new - it gets added ·{' '}
        <span className={`${chip} border-amber-300 bg-amber-50 text-amber-900`}>amber</span> replaces the saved number (the old one shows underneath) ·{' '}
        <span className={`${chip} border-red-300 bg-red-50 text-red-900`}>red</span> can't be saved. Type over any number to fix it.
      </div>
    </details>
  );
}

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Character-bigram Dice similarity: "AP Solus eDMs - MSK Pain" scores ~0.95 against
// "AP Solus eDM - MSK Pain" and well below any other card sharing only the topic.
function similarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ga = grams(a), gb = grams(b);
  let inter = 0;
  ga.forEach((n, g) => {
    const m = gb.get(g);
    if (m) inter += Math.min(n, m);
  });
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

// ── "Create new placement" summary: spell out exactly what saving will make ────

const TEMPLATE_LABELS: Record<string, string> = {
  Edm: 'eDM',
  DigitalDisplay: 'Digital display',
  Print: 'Print',
  SponsoredContent: 'Sponsored content',
  Education: 'Education',
};

function CreateSummary({
  keyId, defaultName, matchHint, createNames, setCreateNames, brand, publisherName, audienceName, template, allPlacements, onUseExisting,
}: {
  keyId: string;
  defaultName: string;
  matchHint: string; // the most specific bit of the name (send topic / block name) to check for existing doubles
  createNames: Record<string, string>;
  setCreateNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  brand: string;
  publisherName: string;
  audienceName: string;
  template: string;
  allPlacements: PlacementListItem[];
  onUseExisting: (id: string) => void;
}) {
  const proposed = createNames[keyId] ?? defaultName;
  const dupes = useMemo(() => {
    const t = normName(matchHint);
    const prop = normName(proposed);
    if (prop.length < 4) return [];
    return allPlacements
      .map((pl) => {
        const n = normName(pl.name);
        // Similarity to the full proposed name ranks first; containing the topic
        // alone is a weaker signal that only counts as a floor.
        const score = similarity(prop, n) + (t.length >= 4 && n.includes(t) ? 0.15 : 0);
        return { pl, score };
      })
      .filter((x) => x.score >= 0.55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.pl);
  }, [allPlacements, matchHint, proposed]);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
      <div className="text-xs font-semibold text-sky-900">This makes a brand-new placement when you save. Check its name:</div>
      <input
        value={proposed}
        onChange={(e) => setCreateNames((m) => ({ ...m, [keyId]: e.target.value }))}
        className="h-8 w-full max-w-md rounded border border-sky-300 bg-white px-2 text-sm text-ph-charcoal"
      />
      <div className="text-[11px] text-ph-charcoal/55">
        {[brand, audienceName || 'audience: pick below', publisherName || 'publisher: pick below', TEMPLATE_LABELS[template] ?? template].join(' · ')}
      </div>
      {dupes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          <span className="font-medium">Hold up - you might already have this one:</span>
          {dupes.map((pl) => (
            <button
              key={pl.id}
              type="button"
              className="rounded-md border border-amber-400 bg-white px-2 py-0.5 text-amber-900 hover:bg-amber-100"
              onClick={() => onUseExisting(pl.id)}
            >
              use "{pl.name}"
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── eDM send dates: the AI reads them from the note; the admin can add/remove ──

function SendDatesEditor({
  sKey,
  dates,
  setDates,
}: {
  sKey: string;
  dates: string[];
  setDates: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}) {
  const add = (iso: string) => {
    if (!iso) return;
    setDates((m) => {
      const cur = m[sKey] ?? [];
      return cur.includes(iso) ? m : { ...m, [sKey]: [...cur, iso].sort() };
    });
  };
  const remove = (iso: string) =>
    setDates((m) => ({ ...m, [sKey]: (m[sKey] ?? []).filter((d) => d !== iso) }));

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-ph-charcoal/70">Send dates:</span>
      {dates.length === 0 && <span className="text-[11px] text-ph-charcoal/45">none found - add one if you know it</span>}
      {dates.map((d) => (
        <span key={d} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-900">
          {fmtDate(d)}
          <button
            type="button"
            className="leading-none text-violet-500 hover:text-violet-800"
            onClick={() => remove(d)}
            aria-label={`remove ${fmtDate(d)}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="date"
        value=""
        onChange={(e) => add(e.target.value)}
        className="h-6 rounded border border-violet-200 bg-white px-1 text-[11px] text-ph-charcoal/70"
        title="Add a send date"
      />
    </div>
  );
}

// ── Destination chooser: three visible choices, nothing hidden in a menu ───────

function DestinationChooser({
  keyId,
  value,
  setTarget,
  candidates,
  allPlacements,
  createName,
}: {
  keyId: string;
  value: string;
  setTarget: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  candidates: { placementId: string; name: string; template: string }[];
  allPlacements: PlacementListItem[];
  createName: string;
}) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const set = (v: string) => {
    setTarget((m) => ({ ...m, [keyId]: v }));
    setSearching(false);
    setQ('');
  };

  const chips = candidates.slice(0, 3);
  const chosenViaSearch =
    value !== '' && value !== CREATE && !chips.some((c) => c.placementId === value)
      ? allPlacements.find((pl) => pl.id === value)?.name ?? 'chosen placement'
      : null;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? allPlacements.filter((pl) => pl.name.toLowerCase().includes(needle)) : allPlacements;
    return base.slice(0, 8);
  }, [q, allPlacements]);

  const chipOn = 'rounded-md border-2 border-ph-purple bg-ph-purple/10 px-2.5 py-1 text-sm font-medium text-ph-charcoal';
  const chipOff = 'rounded-md border border-ph-charcoal/25 bg-white px-2.5 py-1 text-sm text-ph-charcoal hover:bg-ph-charcoal/5';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-ph-charcoal/15 bg-ph-charcoal/[0.03] px-3 py-2.5">
      <div className="text-sm font-semibold text-ph-charcoal">Where should these numbers go?</div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ph-charcoal/60">Add to one you already have:</span>
        {chips.map((c) => (
          <button key={c.placementId} type="button" onClick={() => set(c.placementId)} className={value === c.placementId ? chipOn : chipOff}>
            {c.name}
          </button>
        ))}
        {chosenViaSearch && <span className={chipOn}>{chosenViaSearch}</span>}
        <button type="button" onClick={() => setSearching((v) => !v)} className="rounded-md px-2 py-1 text-sm text-ph-purple underline-offset-2 hover:underline">
          {chips.length > 0 ? 'search all…' : 'search your placements…'}
        </button>
      </div>

      {searching && (
        <div className="flex flex-col gap-1 rounded-md border border-ph-charcoal/15 bg-white p-2 text-xs">
          <input
            autoFocus
            placeholder="Type part of a placement name…"
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            className="h-8 w-full rounded border border-ph-charcoal/20 px-2"
          />
          <ul className="max-h-48 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" className="w-full rounded px-2 py-1 text-left hover:bg-ph-purple/5" onClick={() => set(r.id)}>
                  {r.name} ({r.templateCode})
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-2 py-1 text-ph-charcoal/50">Nothing matches that name.</li>}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => set(CREATE)}
        className={
          value === CREATE
            ? 'w-fit rounded-md border-2 border-ph-purple bg-ph-purple/10 px-2.5 py-1 text-left text-sm font-medium text-ph-charcoal'
            : 'w-fit rounded-md border border-ph-charcoal/25 bg-white px-2.5 py-1 text-left text-sm text-ph-charcoal hover:bg-ph-charcoal/5'
        }
      >
        None of these - create a new placement called "{createName}"
      </button>

      <div className="text-[11px] text-ph-charcoal/45">Don't want to import this block at all? Use Skip at the bottom of the card.</div>
    </div>
  );
}

// ── Type-ahead target picker (placements) ─────────────────────────────────────

function TypeaheadTarget({
  keyId,
  value,
  setTarget,
  candidates,
  allPlacements,
  matchedName,
  canCreate,
  emptyLabel = 'Skip',
}: {
  keyId: string;
  value: string;
  setTarget: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  candidates: { placementId: string; name: string; template: string }[];
  allPlacements: PlacementListItem[];
  matchedName: string | null;
  canCreate?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const set = (v: string) => { setTarget((m) => ({ ...m, [keyId]: v })); setOpen(false); setQ(''); };

  const chosenName =
    value === CREATE ? 'Create new placement'
    : value === '' ? emptyLabel
    : allPlacements.find((p) => p.id === value)?.name ?? matchedName ?? 'the chosen placement';

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? allPlacements.filter((p) => p.name.toLowerCase().includes(needle)) : allPlacements;
    return base.slice(0, 8);
  }, [q, allPlacements]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          value === ''
            ? 'inline-flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100'
            : 'inline-flex items-center gap-2 rounded-md border border-ph-charcoal/25 bg-white px-3 py-1.5 text-sm text-ph-charcoal hover:bg-ph-charcoal/5'
        }
      >
        <span>{chosenName}</span>
        <span className="inline-block h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-current opacity-50" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 flex w-80 max-w-[90vw] flex-col gap-1 rounded-md border border-ph-charcoal/15 bg-white p-2 text-xs shadow-lg">
          <input
            autoFocus
            placeholder="Search existing placements…"
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            className="h-8 w-full rounded border border-ph-charcoal/20 px-2"
          />
          <div className="flex flex-wrap gap-1">
            {canCreate && <button className="rounded bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100" onClick={() => set(CREATE)}>Create new placement</button>}
            <button className="rounded bg-ph-charcoal/5 px-2 py-1 hover:bg-ph-charcoal/10" onClick={() => set('')}>Skip</button>
          </div>
          {candidates.length > 0 && q.trim() === '' && (
            <div className="text-[10px] uppercase tracking-wide text-ph-charcoal/40">suggested</div>
          )}
          <ul className="max-h-48 overflow-y-auto">
            {(q.trim() === '' ? candidates.map((c) => ({ id: c.placementId, name: `${c.name} (${c.template})` })) : results.map((r) => ({ id: r.id, name: `${r.name} (${r.templateCode})` }))).map((o) => (
              <li key={o.id}>
                <button className="w-full rounded px-2 py-1 text-left hover:bg-ph-purple/5" onClick={() => set(o.id)}>{o.name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Diff cell ─────────────────────────────────────────────────────────────────

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 ${className ?? ''}`}>{children}</span>;
}

function DiffCell({ outcome, oldValue, value, disabled, edited, onChange }: {
  outcome: Outcome;
  oldValue: number | null;
  value: number;
  disabled?: boolean;
  edited?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col items-end">
      <input
        type="number"
        disabled={disabled}
        value={edited !== undefined ? edited : String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={`h-7 w-20 rounded border px-1.5 text-right text-xs text-ph-charcoal disabled:opacity-60 ${OUTCOME_CELL[outcome]}`}
      />
      {outcome === 'change' && oldValue !== null && <span className="text-[10px] text-ph-charcoal/50">was {fmt(oldValue)}</span>}
      {outcome === 'invalid' && <span className="text-[10px] text-red-600">no metric</span>}
    </div>
  );
}
