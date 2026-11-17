import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listVersions, restoreVersion, type CourseVersion } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export function HistoryModal({
  courseId,
  canRestore,
  onClose,
}: {
  courseId: string;
  canRestore: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['course-versions', courseId],
    queryFn: () => listVersions(courseId),
    staleTime: 0,
  });
  const restore = useMutation({
    mutationFn: (v: CourseVersion) => restoreVersion(courseId, v.id),
    onSuccess: (course) => {
      queryClient.setQueryData(['course', courseId], course);
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const pick = (v: CourseVersion) => {
    const ok = window.confirm(
      `Restore the course as it was on ${when(v.savedAt)}? The current course is kept in ` +
        'history, so you can restore it again.',
    );
    if (ok) restore.mutate(v);
  };

  return (
    <Modal open onClose={onClose} title="Version history" className="max-w-lg">
      <div className="space-y-3 px-6 py-5 text-sm text-ph-charcoal">
        <p className="text-ph-charcoal/60">
          A copy is kept at most every 5 minutes while the course is being edited. Copies older
          than a week are thinned to one a day.
        </p>
        {!canRestore && (
          <p className="rounded-md bg-amber-50 p-3 text-amber-800">
            Wait for your changes to save before restoring.
          </p>
        )}
        {isLoading && <p className="text-ph-charcoal/60">Loading…</p>}
        {error && <p className="text-red-700">{error.message}</p>}
        {restore.error && <p className="text-red-700">{restore.error.message}</p>}
        {data?.length === 0 && (
          <p className="text-ph-charcoal/60">
            No earlier versions yet. The first copy is kept on the next save.
          </p>
        )}
        {!!data?.length && (
          <ul className="max-h-[60vh] divide-y divide-ph-charcoal/10 overflow-y-auto rounded-md border border-ph-charcoal/10">
            {data.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{when(v.savedAt)}</p>
                  <p className="truncate text-xs text-ph-charcoal/60">
                    {v.savedByName ?? 'Unknown'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canRestore || restore.isPending}
                  onClick={() => pick(v)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
