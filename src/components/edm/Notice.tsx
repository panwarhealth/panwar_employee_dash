import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  info: {
    box: 'bg-ph-purple/5 text-ph-charcoal/80',
    Icon: Info,
    icon: 'text-ph-purple',
  },
  warning: {
    box: 'bg-amber-50 text-amber-900',
    Icon: AlertTriangle,
    icon: 'text-amber-600',
  },
  error: {
    box: 'bg-red-50 text-red-800',
    Icon: AlertTriangle,
    icon: 'text-red-600',
  },
  success: {
    box: 'bg-emerald-50 text-emerald-900',
    Icon: CheckCircle2,
    icon: 'text-emerald-600',
  },
} as const;

/** Inline message box. The app has no toast library; messages sit next to what they're about. */
export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('flex gap-2.5 rounded-md px-4 py-3 text-sm', t.box, className)}
    >
      <t.Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
