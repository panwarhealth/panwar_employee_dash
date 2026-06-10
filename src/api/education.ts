import { apiFetch } from './client';

/** Mirror of the API's education DTOs (Panwar.Api.Models.DTOs). */
export interface EducationPageSummary {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  chartCount: number;
}

export interface EducationPoint {
  year: number;
  month: number;
  value: number;
}

export interface EducationSeries {
  id: string;
  label: string;
  color: string | null;
  sortOrder: number;
  points: EducationPoint[];
}

export interface EducationAnnotation {
  id: string;
  seriesId: string;
  year: number;
  month: number;
  text: string;
}

export interface EducationChart {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  series: EducationSeries[];
  annotations: EducationAnnotation[];
}

export interface EducationPeriod {
  from: string;
  to: string;
  availableFrom: string | null;
  availableTo: string | null;
}

export interface EducationAssetStatus {
  status: string;
  points: EducationPoint[];
  total: number;
}

/** One row of the page's detail table (the workbook's per-asset education table). */
export interface EducationAsset {
  id: string;
  groupLabel: string;
  brand: string | null;
  type: string | null;
  title: string;
  author: string | null;
  expiry: string | null;
  sortOrder: number;
  statuses: EducationAssetStatus[];
}

/** Full page tree (unwindowed on admin reads). */
export interface EducationPageTree {
  page: EducationPageSummary;
  period: EducationPeriod;
  charts: EducationChart[];
  assets: EducationAsset[];
}

const base = (clientSlug: string) => `/manage/clients/${encodeURIComponent(clientSlug)}/education`;

// ── Pages ────────────────────────────────────────────────────────────────
export const listEducationPages = (clientSlug: string): Promise<EducationPageSummary[]> =>
  apiFetch<{ pages: EducationPageSummary[] }>(base(clientSlug)).then((r) => r.pages);

export const getEducationPage = (clientSlug: string, pageId: string): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/${pageId}`);

export const createEducationPage = (clientSlug: string, body: { name: string; slug?: string }): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(base(clientSlug), { method: 'POST', body });

export const updateEducationPage = (
  clientSlug: string,
  pageId: string,
  body: { name?: string; slug?: string; sortOrder?: number },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/${pageId}`, { method: 'PATCH', body });

export const deleteEducationPage = (clientSlug: string, pageId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/${pageId}`, { method: 'DELETE' });

// ── Charts ───────────────────────────────────────────────────────────────
export const createEducationChart = (
  clientSlug: string,
  pageId: string,
  body: { title: string; subtitle?: string | null },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/${pageId}/charts`, { method: 'POST', body });

export const updateEducationChart = (
  clientSlug: string,
  chartId: string,
  body: { title?: string; subtitle?: string | null; sortOrder?: number },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/charts/${chartId}`, { method: 'PATCH', body });

export const deleteEducationChart = (clientSlug: string, chartId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/charts/${chartId}`, { method: 'DELETE' });

// ── Series ───────────────────────────────────────────────────────────────
export const createEducationSeries = (
  clientSlug: string,
  chartId: string,
  body: { label: string; color?: string | null },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/charts/${chartId}/series`, { method: 'POST', body });

export const updateEducationSeries = (
  clientSlug: string,
  seriesId: string,
  body: { label?: string; color?: string | null; sortOrder?: number },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/series/${seriesId}`, { method: 'PATCH', body });

export const deleteEducationSeries = (clientSlug: string, seriesId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/series/${seriesId}`, { method: 'DELETE' });

export const setEducationSeriesData = (
  clientSlug: string,
  seriesId: string,
  points: EducationPoint[],
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/series/${seriesId}/data`, { method: 'PUT', body: { points } });

// ── Assets (the page's detail table) ─────────────────────────────────────
export interface EducationAssetWriteBody {
  groupLabel?: string;
  brand?: string | null;
  type?: string | null;
  title?: string;
  author?: string | null;
  expiry?: string | null;
  clearExpiry?: boolean;
  sortOrder?: number;
}

export const createEducationAsset = (
  clientSlug: string,
  pageId: string,
  body: EducationAssetWriteBody,
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/${pageId}/assets`, { method: 'POST', body });

export const updateEducationAsset = (
  clientSlug: string,
  assetId: string,
  body: EducationAssetWriteBody,
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/assets/${assetId}`, { method: 'PATCH', body });

export const deleteEducationAsset = (clientSlug: string, assetId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/assets/${assetId}`, { method: 'DELETE' });

export const setEducationAssetValues = (
  clientSlug: string,
  assetId: string,
  values: { status: string; year: number; month: number; value: number }[],
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/assets/${assetId}/values`, { method: 'PUT', body: { values } });

// ── Annotations ──────────────────────────────────────────────────────────
export const createEducationAnnotation = (
  clientSlug: string,
  chartId: string,
  body: { seriesId: string; year: number; month: number; text: string },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/charts/${chartId}/annotations`, { method: 'POST', body });

export const updateEducationAnnotation = (
  clientSlug: string,
  annotationId: string,
  body: { seriesId?: string; year?: number; month?: number; text?: string },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/annotations/${annotationId}`, { method: 'PATCH', body });

export const deleteEducationAnnotation = (clientSlug: string, annotationId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/annotations/${annotationId}`, { method: 'DELETE' });
