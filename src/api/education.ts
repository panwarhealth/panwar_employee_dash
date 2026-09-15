import { apiFetch } from './client';

export interface EducationPageSummary {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  chartCount: number;
  assetCount: number;
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
  points: EducationPoint[];
}

export interface EducationAnnotation {
  id: string;
  brand: string;
  year: number;
  month: number;
  text: string;
}

export interface EducationChart {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  groupLabels: string[];
  brandSeries: EducationSeries[];
  activitySeries: EducationSeries[];
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

export interface EducationPageTree {
  page: EducationPageSummary;
  period: EducationPeriod;
  charts: EducationChart[];
  assets: EducationAsset[];
}

const base = (clientSlug: string) => `/manage/clients/${encodeURIComponent(clientSlug)}/education`;

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

export interface EducationChartWriteBody {
  title?: string;
  subtitle?: string | null;
  sortOrder?: number;
  groupLabels?: string[];
}

export const createEducationChart = (
  clientSlug: string,
  pageId: string,
  body: EducationChartWriteBody & { title: string },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/${pageId}/charts`, { method: 'POST', body });

export const updateEducationChart = (
  clientSlug: string,
  chartId: string,
  body: EducationChartWriteBody,
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/charts/${chartId}`, { method: 'PATCH', body });

export const deleteEducationChart = (clientSlug: string, chartId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/charts/${chartId}`, { method: 'DELETE' });

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

export const createEducationAnnotation = (
  clientSlug: string,
  chartId: string,
  body: { brand: string; year: number; month: number; text: string },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/charts/${chartId}/annotations`, { method: 'POST', body });

export const updateEducationAnnotation = (
  clientSlug: string,
  annotationId: string,
  body: { brand?: string; year?: number; month?: number; text?: string },
): Promise<EducationPageTree> =>
  apiFetch<EducationPageTree>(`${base(clientSlug)}/annotations/${annotationId}`, { method: 'PATCH', body });

export const deleteEducationAnnotation = (clientSlug: string, annotationId: string): Promise<void> =>
  apiFetch<void>(`${base(clientSlug)}/annotations/${annotationId}`, { method: 'DELETE' });
