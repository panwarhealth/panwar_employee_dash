import type { EdmList, EdmSyncSource } from '@/api/edm';

// Formatting shared by the eDM Mailer screens. Staff schedule and read times in Sydney time
// regardless of where the browser is.

const TZ = 'Australia/Sydney';

const dayFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dateFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const longFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "9:00am" */
export const fmtTime = (iso: string) =>
  timeFmt.format(new Date(iso)).replace(' ', '').toLowerCase();

/** "Thu 18 Sep 9:00am" */
export const fmtDayTime = (iso: string) =>
  `${dayFmt.format(new Date(iso)).replace(',', '')} ${fmtTime(iso)}`;

/** "Friday 12 September, 9:02am" */
export const fmtLong = (iso: string) =>
  `${longFmt.format(new Date(iso)).replace(',', '')}, ${fmtTime(iso)}`;

/** "12 Sep 2026" */
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

/** "today", "yesterday", "3 days ago", else a date. */
export function fmtAgo(iso: string): string {
  const day = (d: Date) => partsFmt.format(d).slice(0, 10);
  const then = new Date(iso);
  const days = Math.round((Date.parse(day(new Date())) - Date.parse(day(then))) / 86_400_000);
  if (days <= 0) return `today ${fmtTime(iso)}`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}

/** Sydney wall-clock date and time ("2026-09-18", "09:00") for an instant. */
export function sydneyParts(d: Date): { date: string; time: string } {
  const s = partsFmt.format(d).replace(', ', 'T');
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

/** Tomorrow at 9am Sydney, the usual send slot. */
export function defaultSchedule(): { date: string; time: string } {
  return {
    date: sydneyParts(new Date(Date.now() + 86_400_000)).date,
    time: '09:00',
  };
}

export const num = (n: number) => n.toLocaleString('en-AU');

/** "1 person", "903 people" */
export const people = (n: number) => `${num(n)} ${n === 1 ? 'person' : 'people'}`;

/** Shows merge tags readably outside a real send: "Hi {{first_name|there}}" → "Hi [first name]". */
export const readableTags = (s: string) =>
  s.replace(/\{\{\s*(\w+)\s*(?:\|[^}]*)?\}\}/g, (_, tag: string) => `[${tag.replace('_', ' ')}]`);

export const pct = (part: number, whole: number) =>
  whole === 0 ? '0%' : `${Math.round((part / whole) * 1000) / 10}%`.replace('.0%', '%');

export const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export const selectClass =
  'h-9 w-full rounded-md border border-ph-charcoal/20 bg-white px-3 text-sm text-ph-charcoal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ph-purple/40';

export const labelClass = 'mb-1.5 block text-sm font-medium text-ph-charcoal/70';

/** "903 people · sends as updates@pharmachat.com.au · 14 unsubscribed, 6 bounced · synced from PharmaChat today 9:00am" */
export function listMeta(l: EdmList): string[] {
  const parts = [people(l.subscribed), `sends as ${l.sender.fromAddress}`];
  if (l.unsubscribed || l.bounced)
    parts.push(`${num(l.unsubscribed)} unsubscribed, ${num(l.bounced)} bounced`);
  if (l.syncSource) {
    const source = SOURCE_NAMES[l.syncSource];
    parts.push(
      l.lastSyncedAt ? `synced from ${source} ${fmtAgo(l.lastSyncedAt)}` : `syncs from ${source}`,
    );
  } else {
    parts.push('custom list');
  }
  return parts;
}

export const SOURCE_NAMES: Record<EdmSyncSource, string> = {
  PharmaChat: 'PharmaChat',
  ClinicalStudio: 'Clinical Studio',
};
