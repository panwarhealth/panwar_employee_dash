import { apiFetch } from './client';

export interface CpdInvestmentListItem {
  id: string;
  brandId: string;
  brandName: string;
  audienceId: string;
  audienceName: string;
  publisherId: string;
  publisherName: string;
  year: number;
  startMonth: number | null;
  endMonth: number | null;
  title: string;
  format: string;
  cost: number;
  notes: string | null;
}

export const CPD_FORMATS = [
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'research_paper', label: 'Research Paper' },
] as const;

export const cpdFormatLabel = (value: string) =>
  CPD_FORMATS.find((f) => f.value === value)?.label ?? value;

export const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
] as const;

const monthLabel = (value: number) => MONTHS.find((m) => m.value === value)?.label ?? String(value);

export const monthRangeLabel = (start: number | null, end: number | null): string => {
  if (start == null || end == null) return '-';
  return start === end ? monthLabel(start) : `${monthLabel(start)} - ${monthLabel(end)}`;
};

export interface CpdInvestmentListResponse {
  items: CpdInvestmentListItem[];
  years: number[];
}

export interface CpdInvestmentWriteBody {
  brandId: string;
  audienceId: string;
  publisherId: string;
  year: number;
  startMonth?: number | null;
  endMonth?: number | null;
  title: string;
  format: string;
  cost: number;
  notes?: string | null;
}

export const listCpdInvestments = (
  clientSlug: string,
  year: number,
): Promise<CpdInvestmentListResponse> =>
  apiFetch<CpdInvestmentListResponse>(`/manage/clients/${clientSlug}/cpd-investments?year=${year}`);

export const createCpdInvestment = (clientSlug: string, body: CpdInvestmentWriteBody): Promise<{ id: string }> =>
  apiFetch<{ id: string }>(`/manage/clients/${clientSlug}/cpd-investments`, { method: 'POST', body });

export const updateCpdInvestment = (
  clientSlug: string,
  id: string,
  body: CpdInvestmentWriteBody,
): Promise<void> =>
  apiFetch<void>(`/manage/clients/${clientSlug}/cpd-investments/${id}`, { method: 'PATCH', body });

export const deleteCpdInvestment = (clientSlug: string, id: string): Promise<void> =>
  apiFetch<void>(`/manage/clients/${clientSlug}/cpd-investments/${id}`, { method: 'DELETE' });
