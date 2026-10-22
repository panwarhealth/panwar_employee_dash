import type { GroupBy, ReportFilter } from '@/api/timesheets';
import { periodEnd, periodStart, todayIso, type Period } from '@/lib/timesheets';

export interface ReportSearch {
  period?: Period;
  from?: string;
  to?: string;
  group?: GroupBy;
  openOnly?: boolean;
  clientIds?: string;
  jobIds?: string;
  taskIds?: string;
  personIds?: string;
  roles?: string;
  by?: DetailBy;
  archived?: boolean;
}

export type DetailBy = 'date' | 'client' | 'job' | 'task' | 'person';
const BYS: DetailBy[] = ['date', 'client', 'job', 'task', 'person'];

const PERIOD_VALUES: Period[] = ['week', 'semimonth', 'month', 'quarter', 'year', 'all', 'custom'];
const GROUPS: GroupBy[] = ['client', 'job', 'task', 'person'];
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isIds = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f,-]+$/i.test(v);

export const validateReportSearch = (s: Record<string, unknown>): ReportSearch => ({
  period: PERIOD_VALUES.includes(s.period as Period) ? (s.period as Period) : undefined,
  from: isDate(s.from) ? s.from : undefined,
  to: isDate(s.to) ? s.to : undefined,
  group: GROUPS.includes(s.group as GroupBy) ? (s.group as GroupBy) : undefined,
  openOnly: s.openOnly === true || s.openOnly === 'true' ? true : undefined,
  clientIds: isIds(s.clientIds) ? s.clientIds : undefined,
  jobIds: isIds(s.jobIds) ? s.jobIds : undefined,
  taskIds: isIds(s.taskIds) ? s.taskIds : undefined,
  personIds: isIds(s.personIds) ? s.personIds : undefined,
  roles: typeof s.roles === 'string' && s.roles.length > 0 ? s.roles : undefined,
  by: BYS.includes(s.by as DetailBy) ? (s.by as DetailBy) : undefined,
  archived: s.archived === true || s.archived === 'true' ? true : undefined,
});

export const periodOf = (s: ReportSearch): Period => s.period ?? (s.from ? 'custom' : 'week');

export const toFilter = (s: ReportSearch): ReportFilter => {
  const period = periodOf(s);
  const split = (v?: string) => (v ? v.split(',') : undefined);
  const range =
    period === 'all'
      ? {}
      : period === 'custom'
        ? { from: s.from, to: s.to }
        : (() => {
            const from = s.from ?? periodStart(period, todayIso());
            return { from, to: periodEnd(period, from) };
          })();
  return {
    ...range,
    clientIds: split(s.clientIds),
    jobIds: split(s.jobIds),
    taskIds: split(s.taskIds),
    personIds: split(s.personIds),
    roles: s.roles ? s.roles.split('|') : undefined,
    openOnly: s.openOnly,
  };
};
