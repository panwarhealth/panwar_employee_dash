import { apiFetch } from './client';

export interface YearSummary {
  year: number;
  text: string;
  updatedAt: string | null;
}

export interface YearSummaryResponse {
  summary: YearSummary | null;
  years: number[];
}

export const getYearSummary = (clientSlug: string, year: number): Promise<YearSummaryResponse> =>
  apiFetch<YearSummaryResponse>(`/manage/clients/${clientSlug}/summary?year=${year}`);

/** Empty text deletes the year's summary (API returns 204). */
export const putYearSummary = (
  clientSlug: string,
  body: { year: number; text: string },
): Promise<YearSummary | void> =>
  apiFetch<YearSummary | void>(`/manage/clients/${clientSlug}/summary`, { method: 'PUT', body });
