import type { TsLevel } from '@/api/timesheets';

const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayIso = () => toIso(new Date());

export const addDays = (iso: string, days: number) => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

export const JOB_COLOURS: Record<string, string> = {
  red: '#d92f2f',
  orange: '#fa5d00',
  magenta: '#db2777',
  purple: '#7d3c91',
  blue: '#376bdd',
  aqua: '#1496c8',
  green: '#188433',
  gray: '#8d8e8d',
  black: '#3b3940',
};

export const weekdayIndex = (iso: string) => (fromIso(iso).getDay() + 6) % 7;

export const dayCapacity = (
  person: { dayHours: number[]; capacityChanges: { date: string; hours: number }[] },
  date: string,
) =>
  person.capacityChanges.find((c) => c.date === date)?.hours ??
  person.dayHours[weekdayIndex(date)] ??
  0;

export const workingDays = (
  person: { dayHours: number[]; capacityChanges: { date: string; hours: number }[] },
  from: string,
  to: string,
  onDaysOff = false,
) => dateRange(from, to).filter((d) => onDaysOff || dayCapacity(person, d) > 0).length;

export const weekStart = (iso: string) => addDays(iso, -weekdayIndex(iso));

export const daysApart = (from: string, to: string) =>
  Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86_400_000);

export const dateRange = (from: string, to: string) =>
  Array.from({ length: Math.max(0, daysApart(from, to) + 1) }, (_, i) => addDays(from, i));

export const weekDays = (start: string) => dateRange(start, addDays(start, 6));

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const fmtDate = (iso: string, options: Intl.DateTimeFormatOptions) =>
  fromIso(iso).toLocaleDateString('en-AU', options);

export const fmtWeek = (start: string) => {
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = fmtDate(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  return `${from} - ${fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

export const fmtHm = (hours: number) => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
};

export const fmtDec = (hours: number) => hours.toFixed(2);

export const parseHours = (text: string): number | null => {
  const t = text.trim();
  if (t === '') return 0;
  const hm = /^(\d*):(\d{1,2})$/.exec(t);
  if (hm) {
    const minutes = Number(hm[2]);
    return minutes < 60 ? Number(hm[1] || 0) + minutes / 60 : null;
  }
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const roundHours = (hours: number) => Math.round(hours * 100) / 100;

export const runningHours = (hours: number, timerStartedAt: string | null, now: number) =>
  timerStartedAt ? hours + (now - Date.parse(timerStartedAt)) / 3_600_000 : hours;

export const jobLabel = (code: string, title: string) => (code ? `[${code}] ${title}` : title);

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const isManager = (level: TsLevel) => level !== 'Member';
export const isAdmin = (level: TsLevel) => level === 'Admin';

export type Period = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const monthsIn: Partial<Record<Period, number>> = {
  month: 1,
  quarter: 3,
  year: 12,
};

export const periodStart = (period: Period, iso: string) => {
  if (period === 'week') return weekStart(iso);
  const d = fromIso(iso);
  const months = monthsIn[period];
  if (!months) return iso;
  const month = months === 12 ? 0 : Math.floor(d.getMonth() / months) * months;
  return toIso(new Date(d.getFullYear(), month, 1));
};

export const periodEnd = (period: Period, start: string) => {
  if (period === 'week') return addDays(start, 6);
  const d = fromIso(start);
  return toIso(new Date(d.getFullYear(), d.getMonth() + (monthsIn[period] ?? 0), 0));
};

export const shiftPeriod = (period: Period, start: string, by: number) => {
  if (period === 'week') return addDays(start, 7 * by);
  const d = fromIso(start);
  return toIso(new Date(d.getFullYear(), d.getMonth() + (monthsIn[period] ?? 0) * by, 1));
};

export const periodLabel = (period: Period, from?: string, to?: string) => {
  if (period === 'all' || !from) return 'All time';
  if (period === 'week') return fmtWeek(from);
  if (period === 'month') return fmtDate(from, { month: 'long', year: 'numeric' });
  if (period === 'year') return fmtDate(from, { year: 'numeric' });
  return `${fmtDate(from, { day: 'numeric', month: 'short', year: 'numeric' })} - ${fmtDate(to ?? from, { day: 'numeric', month: 'short', year: 'numeric' })}`;
};
