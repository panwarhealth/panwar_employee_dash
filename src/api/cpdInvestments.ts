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

export interface CpdInvestmentListResponse {
  items: CpdInvestmentListItem[];
  years: number[];
}

export interface CpdInvestmentWriteBody {
  brandId: string;
  audienceId: string;
  publisherId: string;
  year: number;
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
