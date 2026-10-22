import { apiDownload, apiFetch } from './client';

export type TsLevel = 'Member' | 'Manager' | 'Admin';

export interface TsViewer {
  personId: string;
  name: string;
  level: TsLevel;
}

export interface Named {
  id: string;
  name: string;
}

export interface TsEntry {
  id: string;
  personId: string;
  date: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  clientName: string;
  taskId: string;
  taskName: string;
  hours: number;
  notes: string;
  timerStartedAt: string | null;
}

export interface TsStar {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  clientName: string;
  taskId: string;
  taskName: string;
}

export interface TsTime {
  entries: TsEntry[];
  stars: TsStar[];
}

export interface ScheduleExport {
  kind: 'projects' | 'team';
  tasks: boolean;
  period: 'week' | 'month';
  rows: boolean;
  from: string;
  to: string;
}

export interface PickJob {
  id: string;
  code: string;
  title: string;
  clientName: string;
  tasks: Named[];
}

export interface EntryBody {
  personId?: string;
  date: string;
  jobId: string;
  taskId: string;
  hours: number;
  notes: string;
  startTimer?: boolean;
}

export interface JobRow {
  id: string;
  code: string;
  title: string;
  clientId: string;
  clientName: string;
  spent: number;
  archived: boolean;
}

export interface JobDetail {
  id: string;
  code: string;
  title: string;
  clientId: string;
  clientName: string;
  archived: boolean;
  isLeave: boolean;
  everyone: boolean;
  alertPercent: number | null;
  trelloCardUrl: string | null;
  openedOn: string;
  spent: number;
  budget: number | null;
  tasks: {
    taskId: string;
    name: string;
    budget: number | null;
    spent: number;
  }[];
  people: {
    personId: string;
    name: string;
    isManager: boolean;
    canLog: boolean;
    spent: number;
  }[];
  weeks: { weekStart: string; hours: number }[];
}

export interface JobBody {
  clientId: string;
  code: string;
  title: string;
  isLeave: boolean;
  alertPercent: number | null;
  tasks: { taskId: string; budgetHours: number | null }[];
  people: { personId: string; isManager: boolean }[];
  createTrelloCard: boolean;
}

export interface Client {
  id: string;
  name: string;
  codePrefix: string | null;
  suppliesOwnCodes: boolean;
  nextCode: string | null;
}

export interface ClientBody {
  name: string;
  codePrefix: string | null;
  suppliesOwnCodes: boolean;
}

export interface Task {
  id: string;
  name: string;
  isCommon: boolean;
  archived: boolean;
}

export interface CapacityChange {
  date: string;
  hours: number;
  note: string | null;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  isContractor: boolean;
  isPlaceholder: boolean;
  archived: boolean;
  dayHours: number[];
  capacityChanges: CapacityChange[];
  managedPersonIds: string[];
}

export type PersonBody = Omit<Person, 'id' | 'dayHours' | 'capacityChanges'>;

export interface TeamRow {
  personId: string;
  name: string;
  title: string | null;
  role: string | null;
  isContractor: boolean;
  hours: number;
  baseCapacity: number;
  leave: number;
  notDone: boolean;
}

export interface ScheduleWeek {
  start: string;
  capacity: number;
  booked: number;
  off: number;
  percent: number | null;
}

export interface ScheduleDay {
  date: string;
  capacity: number;
  booked: number;
  off: number;
}

export interface SchedulePerson {
  id: string;
  name: string;
  title: string | null;
  isPlaceholder: boolean;
  weeks: ScheduleWeek[];
  days: ScheduleDay[];
}

export interface ScheduleJob {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  clientName: string;
  isLeave: boolean;
  weeks: number[];
}

export interface Booking {
  id: string;
  personId: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  clientName: string;
  isLeave: boolean;
  taskId: string | null;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  note: string | null;
}

export interface Schedule {
  people: SchedulePerson[];
  jobs: ScheduleJob[];
  bookings: Booking[];
}

export type BookingBody = Omit<Booking, 'id' | 'jobCode' | 'jobTitle' | 'clientName' | 'isLeave'>;

export interface Summary {
  total: number;
  rows: { id: string; name: string; hours: number }[];
}

export interface Detailed {
  total: number;
  count: number;
  headers: string[];
  rows: string[][];
}

export interface ReportOptions {
  clients: Named[];
  jobs: Named[];
  tasks: Named[];
  people: Named[];
}

export interface SavedReport {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

export type GroupBy = 'client' | 'job' | 'task' | 'person';

export interface ReportFilter {
  from?: string;
  to?: string;
  clientIds?: string[];
  jobIds?: string[];
  taskIds?: string[];
  personIds?: string[];
  openOnly?: boolean;
}

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && s.set(k, v));
  return s.toString();
};

const filterQuery = (f: ReportFilter) =>
  qs({
    from: f.from,
    to: f.to,
    clientIds: f.clientIds?.join(','),
    jobIds: f.jobIds?.join(','),
    taskIds: f.taskIds?.join(','),
    personIds: f.personIds?.join(','),
    openOnly: f.openOnly ? 'true' : undefined,
  });

export const ts = {
  me: () => apiFetch<TsViewer>('/ts/me'),

  time: (from: string, to: string, personId?: string) =>
    apiFetch<TsTime>(`/ts/time?${qs({ from, to, personId })}`),
  pickableJobs: (personId?: string) =>
    apiFetch<{ jobs: PickJob[] }>(`/ts/pickable-jobs?${qs({ personId })}`).then((r) => r.jobs),
  createEntry: (body: EntryBody) => apiFetch<TsEntry>('/ts/entries', { method: 'POST', body }),
  updateEntry: (id: string, body: EntryBody) =>
    apiFetch<TsEntry>(`/ts/entries/${id}`, { method: 'PUT', body }),
  deleteEntry: (id: string) => apiFetch<void>(`/ts/entries/${id}`, { method: 'DELETE' }),
  startTimer: (id: string) => apiFetch<TsEntry>(`/ts/entries/${id}/start`, { method: 'POST' }),
  stopTimer: (id: string, notes: string) =>
    apiFetch<TsEntry>(`/ts/entries/${id}/stop`, {
      method: 'POST',
      body: { notes },
    }),
  setStar: (jobId: string, taskId: string, starred: boolean) =>
    apiFetch<void>('/ts/stars', {
      method: 'PUT',
      body: { jobId, taskId, starred },
    }),
  deleteRow: (weekStart: string, jobId: string, taskId: string) =>
    apiFetch<void>(`/ts/rows?${qs({ weekStart, jobId, taskId })}`, {
      method: 'DELETE',
    }),

  jobs: (status: 'open' | 'archived' | 'all') =>
    apiFetch<{ jobs: JobRow[] }>(`/ts/jobs?status=${status}`).then((r) => r.jobs),
  job: (id: string, from?: string, to?: string) =>
    apiFetch<JobDetail>(`/ts/jobs/${id}?${qs({ from, to })}`),
  nextCode: (clientId: string) =>
    apiFetch<{ code: string | null; lastJob: string | null }>(`/ts/clients/${clientId}/next-code`),
  createJob: (body: JobBody) => apiFetch<JobDetail>('/ts/jobs', { method: 'POST', body }),
  updateJob: (id: string, body: JobBody) =>
    apiFetch<JobDetail>(`/ts/jobs/${id}`, { method: 'PUT', body }),
  setJobArchived: (id: string, archived: boolean) =>
    apiFetch<void>(`/ts/jobs/${id}/archived`, {
      method: 'PUT',
      body: { archived },
    }),

  clients: () => apiFetch<{ clients: Client[] }>('/ts/clients').then((r) => r.clients),
  createClient: (body: ClientBody) => apiFetch<Client>('/ts/clients', { method: 'POST', body }),
  updateClient: (id: string, body: ClientBody) =>
    apiFetch<Client>(`/ts/clients/${id}`, { method: 'PUT', body }),

  tasks: () => apiFetch<{ tasks: Task[] }>('/ts/tasks').then((r) => r.tasks),
  createTask: (body: Omit<Task, 'id'>) => apiFetch<Task>('/ts/tasks', { method: 'POST', body }),
  updateTask: (id: string, body: Omit<Task, 'id'>) =>
    apiFetch<Task>(`/ts/tasks/${id}`, { method: 'PUT', body }),

  people: () => apiFetch<{ people: Person[] }>('/ts/people').then((r) => r.people),
  createPerson: (body: PersonBody) => apiFetch<Person>('/ts/people', { method: 'POST', body }),
  updatePerson: (id: string, body: PersonBody) =>
    apiFetch<Person>(`/ts/people/${id}`, { method: 'PUT', body }),
  setCapacity: (id: string, dayHours: number[], changes: CapacityChange[]) =>
    apiFetch<Person>(`/ts/people/${id}/capacity`, {
      method: 'PUT',
      body: { dayHours, changes },
    }),
  team: (weekStart: string) =>
    apiFetch<{ people: TeamRow[] }>(`/ts/team?weekStart=${weekStart}`).then((r) => r.people),

  schedule: (weekStart: string, weeks: number) =>
    apiFetch<Schedule>(`/ts/schedule?${qs({ weekStart, weeks: String(weeks) })}`),
  exportSchedule: (o: ScheduleExport) =>
    apiDownload(
      `/ts/schedule/export.csv?${qs({
        kind: o.kind,
        tasks: o.kind === 'projects' && o.tasks ? 'true' : undefined,
        period: o.period,
        rows: o.rows ? 'true' : undefined,
        from: o.from,
        to: o.to,
      })}`,
      `${o.kind === 'team' ? 'team' : 'project'}-export-from-${o.from}-to-${o.to}.csv`,
    ),
  createBooking: (body: BookingBody) => apiFetch<Booking>('/ts/bookings', { method: 'POST', body }),
  updateBooking: (id: string, body: BookingBody) =>
    apiFetch<Booking>(`/ts/bookings/${id}`, { method: 'PUT', body }),
  deleteBooking: (id: string) => apiFetch<void>(`/ts/bookings/${id}`, { method: 'DELETE' }),

  summary: (f: ReportFilter, groupBy: GroupBy) =>
    apiFetch<Summary>(`/ts/reports/summary?${filterQuery(f)}&groupBy=${groupBy}`),
  detailed: (f: ReportFilter) => apiFetch<Detailed>(`/ts/reports/detailed?${filterQuery(f)}`),
  reportOptions: () => apiFetch<ReportOptions>('/ts/reports/options'),
  exportReport: (f: ReportFilter, format: 'csv' | 'xlsx') =>
    apiDownload(
      `/ts/reports/export.${format}?${filterQuery(f)}`,
      `time_report_from${f.from ?? ''}to${f.to ?? ''}.${format}`,
    ),
  savedReports: () =>
    apiFetch<{ reports: SavedReport[] }>('/ts/saved-reports').then((r) => r.reports),
  saveReport: (name: string, query: string) =>
    apiFetch<SavedReport>('/ts/saved-reports', {
      method: 'POST',
      body: { name, query },
    }),
  deleteSavedReport: (id: string) =>
    apiFetch<void>(`/ts/saved-reports/${id}`, { method: 'DELETE' }),
};
