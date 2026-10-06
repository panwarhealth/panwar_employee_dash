import type { ReactNode } from 'react';

/** The tinted two-column fact box on the send step and the report. */
export function SummaryBox({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 rounded-md bg-ph-purple/5 p-6 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-sm text-ph-charcoal/60">{item.label}</dt>
          <dd className="mt-0.5 break-words font-semibold text-ph-charcoal">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
