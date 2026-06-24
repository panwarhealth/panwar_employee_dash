import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/api/client';
import { useWorkspaceYear } from '@/lib/workspaceYear';
import { listPlacements, type PlacementListItem } from '@/api/placements';
import {
  requestImportUploadUrl,
  buildImportPreview,
  commitImport,
  type ImportPreview,
  type PlacementDiff,
  type EducationDiff,
  type ActualDiff,
  type EducationValueDiff,
  type Outcome,
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

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [target, setTarget] = useState<Record<string, string>>({}); // key -> placementId | CREATE | ''(skip)
  const [decision, setDecision] = useState<Record<string, Decision>>({}); // key -> approve|skip (undefined = pending)
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showClean, setShowClean] = useState(false);
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

  const previewMutation = useMutation({
    mutationFn: () =>
      buildImportPreview(clientSlug, {
        year,
        files: uploads.filter((u) => u.status === 'done').map((u) => ({ objectKey: u.objectKey, fileName: u.fileName })),
      }),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewError(null);
      const t: Record<string, string> = {};
      data.placements.forEach((p, i) => {
        t[`p${i}`] = p.matchStatus === 'matched' && p.placementId ? p.placementId : CREATE;
      });
      data.education.forEach((e, i) => {
        t[`e${i}`] = e.matchStatus === 'matched' && e.assetId ? e.assetId : '';
      });
      setTarget(t);
      setDecision({});
      setEdits({});
      setAcknowledged(false);
      setShowClean(false);
    },
    onError: (e) => setPreviewError(e instanceof ApiError ? e.message : 'Preview failed'),
  });

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

      const placements = preview!.placements
        .map((p, i) => {
          if (decision[`p${i}`] !== 'approve') return null;
          const tgt = target[`p${i}`] ?? '';
          if (!tgt) return null;
          const creating = tgt === CREATE;
          const isMatched = !creating && tgt === p.placementId;
          const actuals = p.rows
            .filter((r) => r.outcome !== 'invalid')
            .filter((r) => !isMatched || r.outcome !== 'match' || isEdited(pKey(i, r)))
            .map((r) => ({ year: preview!.year, month: r.month, metricKey: r.metric, value: effective(pKey(i, r), r.newValue), note: r.note }));
          if (!actuals.length) return null;
          return creating
            ? { newPlacement: { brand: p.brand, publisher: p.publisher, audience: p.audience, template: p.template, name: p.parsedName, objective: p.objective }, actuals }
            : { placementId: tgt, actuals };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const education = preview!.education
        .map((e, i) => {
          if (decision[`e${i}`] !== 'approve') return null;
          const tgt = target[`e${i}`] ?? '';
          if (!tgt) return null;
          const isMatched = tgt === e.assetId;
          const values = e.rows
            .filter((r) => !isMatched || r.outcome !== 'match' || isEdited(eKey(i, r)))
            .map((r) => ({ status: r.status, year: r.year, month: r.month, value: effective(eKey(i, r), r.newValue) }));
          return values.length ? { assetId: tgt, values } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

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

  const cardProps = { target, setTarget, decision, setDecision: setItemDecision, edits, setEdits, effective, pKey, eKey, allPlacements };

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
              {previewMutation.isPending ? 'Building preview…' : 'Build preview'}
            </Button>
            {previewError && <span className="text-sm text-red-600">{previewError}</span>}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <SummaryBar
            preview={preview}
            cleanCount={cleanKeys.length}
            reviewCount={reviewKeys.length}
            pendingCount={pendingCount}
            cleanPending={cleanPending}
            onApproveAllClean={approveAllClean}
            showClean={showClean}
            setShowClean={setShowClean}
          />

          {/* Review queue: the items that need a human */}
          {preview.placements.map((p, i) =>
            p.needsReview ? <PlacementCard key={`p${i}`} pi={i} p={p} {...cardProps} /> : null,
          )}
          {preview.education.map((e, i) =>
            eduNeedsReview(e) ? <EducationCard key={`e${i}`} ei={i} e={e} {...cardProps} /> : null,
          )}

          {/* Clean items, collapsed by default */}
          {showClean && (
            <>
              {preview.placements.map((p, i) => (!p.needsReview ? <PlacementCard key={`pc${i}`} pi={i} p={p} {...cardProps} /> : null))}
              {preview.education.map((e, i) => (!eduNeedsReview(e) ? <EducationCard key={`ec${i}`} ei={i} e={e} {...cardProps} /> : null))}
            </>
          )}

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
  showClean,
  setShowClean,
}: {
  preview: ImportPreview;
  cleanCount: number;
  reviewCount: number;
  pendingCount: number;
  cleanPending: number;
  onApproveAllClean: () => void;
  showClean: boolean;
  setShowClean: (v: boolean) => void;
}) {
  const h = preview.headline;
  const unmappedMetrics = useMemo(
    () => Array.from(new Set(preview.placements.flatMap((p) => p.rows.filter((r) => r.outcome === 'invalid').map((r) => r.metric)))).sort(),
    [preview.placements],
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill className="bg-emerald-100 text-emerald-800">{cleanCount} clean</Pill>
          <Pill className="bg-amber-100 text-amber-800">{reviewCount} need review</Pill>
          <Pill className="bg-sky-100 text-sky-800">{h.new} new values</Pill>
          {h.invalid > 0 && <Pill className="bg-red-100 text-red-800">{h.invalid} can't be saved</Pill>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={onApproveAllClean} disabled={cleanPending === 0}>
            Approve all {cleanPending} clean
          </Button>
          <span className="text-sm text-ph-charcoal/60">
            {pendingCount === 0 ? 'All reviewed - ready to commit.' : `${pendingCount} left to review`}
          </span>
          {cleanCount > 0 && (
            <button className="text-xs text-ph-purple underline-offset-2 hover:underline" onClick={() => setShowClean(!showClean)}>
              {showClean ? 'hide clean rows' : 'show clean rows'}
            </button>
          )}
        </div>

        {unmappedMetrics.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <div className="font-medium">{h.invalid} value{h.invalid === 1 ? '' : 's'} use metrics with no data store yet, so they can't be saved.</div>
            <div className="mt-0.5">Shown in red below for review. Metric(s): {unmappedMetrics.join(', ')}.</div>
            <div className="mt-0.5">If this data needs storing, contact Rob to add the data store.</div>
          </div>
        )}

        <ul className="flex flex-col gap-1.5 text-xs">
          {preview.sources.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ph-charcoal">{s.file}</span>
              <span className="text-ph-charcoal/50">{s.formatId}</span>
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
  effective: (key: string, fallback: number) => number;
  pKey: (pi: number, r: ActualDiff) => string;
  eKey: (ei: number, r: EducationValueDiff) => string;
  allPlacements: PlacementListItem[];
}

function statusRing(decided: Decision | undefined, needsReview: boolean): string {
  if (decided === 'approve') return 'border-l-4 border-l-emerald-400';
  if (decided === 'skip') return 'border-l-4 border-l-ph-charcoal/30 opacity-60';
  return needsReview ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-200';
}

function DecisionButtons({ decided, onApprove, onSkip, approveDisabled, approveHint }: {
  decided: Decision | undefined;
  onApprove: () => void;
  onSkip: () => void;
  approveDisabled?: boolean;
  approveHint?: string;
}) {
  if (decided === 'approve') return <span className="text-xs text-emerald-700">✓ approved · <button className="underline" onClick={onSkip}>change</button></span>;
  if (decided === 'skip') return <span className="text-xs text-ph-charcoal/50">skipped · <button className="underline" onClick={onApprove}>undo</button></span>;
  return (
    <div className="flex items-center gap-2">
      {approveHint && <span className="text-[11px] text-red-600">{approveHint}</span>}
      <Button size="sm" onClick={onApprove} disabled={approveDisabled}>Approve</Button>
      <Button size="sm" variant="ghost" onClick={onSkip}>Skip</Button>
    </div>
  );
}

// ── Placement card ────────────────────────────────────────────────────────────

function PlacementCard({ pi, p, target, setTarget, decision, setDecision, edits, setEdits, effective, pKey, allPlacements }: CardProps & { pi: number; p: PlacementDiff }) {
  const key = `p${pi}`;
  const tgt = target[key] ?? CREATE;
  const decided = decision[key];

  const months = useMemo(() => Array.from(new Set(p.rows.map((r) => r.month))).sort((a, b) => a - b), [p.rows]);
  const metrics = useMemo(() => Array.from(new Set(p.rows.map((r) => r.metric))), [p.rows]);
  const byCell = useMemo(() => {
    const m = new Map<string, ActualDiff>();
    for (const r of p.rows) m.set(`${r.metric}:${r.month}`, r);
    return m;
  }, [p.rows]);

  const creatingBlocked = tgt === CREATE && (!p.publisher || !p.audience);
  const approveDisabled = !tgt || creatingBlocked;

  return (
    <Card className={statusRing(decided, p.needsReview)}>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-medium text-ph-charcoal">{p.parsedName}</div>
            <div className="text-xs text-ph-charcoal/60">{p.brand} · {p.publisher || 'no publisher'} · {p.template}</div>
          </div>
          <DecisionButtons
            decided={decided}
            onApprove={() => setDecision(key, 'approve')}
            onSkip={() => setDecision(key, 'skip')}
            approveDisabled={approveDisabled}
            approveHint={creatingBlocked ? 'pick a publisher/audience or map to map to existing' : undefined}
          />
        </div>

        {p.notes.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {p.notes.map((n, i) => (
              <div key={i}>📝 {n}</div>
            ))}
          </div>
        )}
        {p.reviewReasons.length > 0 && (
          <div className="text-[11px] text-ph-charcoal/50">{p.reviewReasons.join(' · ')}</div>
        )}

        {p.suggestions.length > 0 && (
          <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs">
            <div className="mb-1 font-medium text-violet-900">
              AI read of this block ({p.suggestions.length} send{p.suggestions.length > 1 ? 's' : ''})
            </div>
            <ul className="flex flex-col gap-1.5">
              {p.suggestions.map((s, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <div className="text-violet-900">
                    <span className="font-medium">{MONTHS[s.month]}</span> · {s.topicLabel}
                    {s.targetName ? <> {'->'} <span className="font-medium">{s.targetName}</span></> : null}
                    <div className="text-[11px] text-violet-700/80">
                      {s.reason}{s.reason ? ' · ' : ''}{Math.round(s.confidence * 100)}% confident
                    </div>
                  </div>
                  {s.targetPlacementId ? (
                    <button
                      type="button"
                      onClick={() => setTarget((m) => ({ ...m, [key]: s.targetPlacementId! }))}
                      className="shrink-0 rounded border border-violet-300 px-2 py-0.5 text-violet-800 hover:bg-violet-100"
                    >
                      Use
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <TypeaheadTarget keyId={key} value={tgt} setTarget={setTarget} candidates={p.candidates} allPlacements={allPlacements} matchedName={p.matchedName} canCreate />

        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-medium text-ph-charcoal/60">Metric</th>
                {months.map((m) => (
                  <th key={m} className="px-2 py-1 text-right font-medium text-ph-charcoal/60">{MONTHS[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric}>
                  <td className="px-2 py-1 text-ph-charcoal">{metric}</td>
                  {months.map((m) => {
                    const c = byCell.get(`${metric}:${m}`);
                    return (
                      <td key={m} className="px-1 py-1">
                        {c ? (
                          <DiffCell
                            outcome={c.outcome}
                            oldValue={c.oldValue}
                            value={effective(pKey(pi, c), c.newValue)}
                            disabled={c.outcome === 'invalid'}
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
      </CardContent>
    </Card>
  );
}

// ── Education card ────────────────────────────────────────────────────────────

function EducationCard({ ei, e, target, setTarget, decision, setDecision, edits, setEdits, effective, eKey }: CardProps & { ei: number; e: EducationDiff }) {
  const key = `e${ei}`;
  const tgt = target[key] ?? '';
  const decided = decision[key];

  // Education maps only to existing assets (candidates); no create path yet.
  const eduOptions = e.candidates.map((c) => ({ id: c.assetId, label: `${c.title} (${c.pageName})` }));
  const approveDisabled = !tgt;

  return (
    <Card className={statusRing(decided, eduNeedsReview(e))}>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-medium text-ph-charcoal">{e.title}</div>
            <div className="text-xs text-ph-charcoal/60">{e.brand}{e.type ? ` · ${e.type}` : ''} · education</div>
          </div>
          <DecisionButtons
            decided={decided}
            onApprove={() => setDecision(key, 'approve')}
            onSkip={() => setDecision(key, 'skip')}
            approveDisabled={approveDisabled}
            approveHint={!tgt ? 'map to an existing module first' : undefined}
          />
        </div>

        {e.matchStatus === 'matched' ? (
          <span className="text-xs text-emerald-700">→ {e.pageName}</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700">{e.matchStatus === 'ambiguous' ? 'ambiguous' : 'no match'}</span>
            <select className="h-8 rounded-md border border-ph-charcoal/20 bg-white px-2 text-xs" value={tgt} onChange={(ev) => setTarget((m) => ({ ...m, [key]: ev.target.value }))}>
              <option value="">skip (leave for manual entry)</option>
              {eduOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-medium text-ph-charcoal/60">Status</th>
                <th className="px-2 py-1 text-left font-medium text-ph-charcoal/60">Period</th>
                <th className="px-2 py-1 text-right font-medium text-ph-charcoal/60">Value</th>
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
        </div>
      </CardContent>
    </Card>
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
}: {
  keyId: string;
  value: string;
  setTarget: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  candidates: { placementId: string; name: string; template: string }[];
  allPlacements: PlacementListItem[];
  matchedName: string | null;
  canCreate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const set = (v: string) => { setTarget((m) => ({ ...m, [keyId]: v })); setOpen(false); setQ(''); };

  const chosenName =
    value === CREATE ? 'Create new placement'
    : value === '' ? 'Skip'
    : allPlacements.find((p) => p.id === value)?.name ?? matchedName ?? 'mapped placement';

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? allPlacements.filter((p) => p.name.toLowerCase().includes(needle)) : allPlacements;
    return base.slice(0, 8);
  }, [q, allPlacements]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-ph-charcoal/50">goes to:</span>
        <span className="font-medium text-ph-charcoal">{chosenName}</span>
        <button className="text-ph-purple underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)}>change</button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 rounded-md border border-ph-charcoal/15 bg-white p-2 text-xs">
          <input
            autoFocus
            placeholder="Search existing placements…"
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            className="h-8 w-full rounded border border-ph-charcoal/20 px-2"
          />
          <div className="flex flex-wrap gap-1">
            {canCreate && <button className="rounded bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100" onClick={() => set(CREATE)}>Create new</button>}
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
