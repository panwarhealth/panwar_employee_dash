import type { EdmCampaignStatus } from '@/api/edm';
import { cn } from '@/lib/utils';

const STYLES: Record<EdmCampaignStatus, string> = {
  Draft: 'bg-ph-charcoal/50',
  Scheduled: 'bg-blue-800',
  Sending: 'bg-ph-coral',
  Sent: 'bg-emerald-700',
  Cancelled: 'bg-red-800',
};

export function StatusBadge({
  status,
  className,
}: {
  status: EdmCampaignStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white',
        STYLES[status],
        className,
      )}
    >
      {status === 'Sending' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      {status}
    </span>
  );
}
