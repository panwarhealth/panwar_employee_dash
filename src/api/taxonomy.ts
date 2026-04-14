import { apiFetch } from './client';

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  placementCount: number;
}

export interface AudienceRow {
  id: string;
  name: string;
  slug: string;
  placementCount: number;
}

export interface MetricField {
  key: string;
  label: string;
  unit: string | null;
}

export interface MetricTemplate {
  id: string;
  code: string;
  name: string;
  fields: MetricField[];
}

export interface PublisherTemplateRef {
  templateId: string;
  templateCode: string;
  templateName: string;
}

export interface Publisher {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  templates: PublisherTemplateRef[];
}

export interface Baseline {
  id: string;
  publisherId: string;
  publisherName: string;
  templateId: string;
  templateCode: string;
  metricKey: string;
  value: number;
  effectiveFrom: string;
  note: string | null;
}

// Brands
export const listBrands = (clientSlug: string): Promise<BrandRow[]> =>
  apiFetch<{ brands: BrandRow[] }>(`/manage/clients/${clientSlug}/brands`).then((r) => r.brands);
export const createBrand = (clientSlug: string, body: { name: string; slug: string }) =>
  apiFetch<BrandRow>(`/manage/clients/${clientSlug}/brands`, { method: 'POST', body });
export const updateBrand = (clientSlug: string, id: string, body: { name: string; slug: string }) =>
  apiFetch<BrandRow>(`/manage/clients/${clientSlug}/brands/${id}`, { method: 'PATCH', body });
export const deleteBrand = (clientSlug: string, id: string) =>
  apiFetch<void>(`/manage/clients/${clientSlug}/brands/${id}`, { method: 'DELETE' });

// Audiences
export const listAudiences = (clientSlug: string): Promise<AudienceRow[]> =>
  apiFetch<{ audiences: AudienceRow[] }>(`/manage/clients/${clientSlug}/audiences`).then((r) => r.audiences);
export const createAudience = (clientSlug: string, body: { name: string; slug: string }) =>
  apiFetch<AudienceRow>(`/manage/clients/${clientSlug}/audiences`, { method: 'POST', body });
export const updateAudience = (clientSlug: string, id: string, body: { name: string; slug: string }) =>
  apiFetch<AudienceRow>(`/manage/clients/${clientSlug}/audiences/${id}`, { method: 'PATCH', body });
export const deleteAudience = (clientSlug: string, id: string) =>
  apiFetch<void>(`/manage/clients/${clientSlug}/audiences/${id}`, { method: 'DELETE' });

// Publishers
export const listPublishers = (): Promise<Publisher[]> =>
  apiFetch<{ publishers: Publisher[] }>(`/manage/publishers`).then((r) => r.publishers);
export const listTemplates = (): Promise<MetricTemplate[]> =>
  apiFetch<{ templates: MetricTemplate[] }>(`/manage/templates`).then((r) => r.templates);
export const createPublisher = (body: {
  name: string; slug: string; website?: string; templateIds: string[];
}) => apiFetch<Publisher>(`/manage/publishers`, { method: 'POST', body });
export const updatePublisher = (id: string, body: {
  name: string; slug: string; website?: string; templateIds: string[];
}) => apiFetch<Publisher>(`/manage/publishers/${id}`, { method: 'PATCH', body });
export const deletePublisher = (id: string) =>
  apiFetch<void>(`/manage/publishers/${id}`, { method: 'DELETE' });

// Baselines
export const listBaselines = (clientSlug: string): Promise<Baseline[]> =>
  apiFetch<{ baselines: Baseline[] }>(`/manage/clients/${clientSlug}/baselines`).then((r) => r.baselines);
export const createBaseline = (clientSlug: string, body: {
  publisherId: string; templateId: string; metricKey: string;
  value: number; effectiveFrom: string; note?: string;
}) => apiFetch<Baseline>(`/manage/clients/${clientSlug}/baselines`, { method: 'POST', body });
export const updateBaseline = (clientSlug: string, id: string, body: {
  publisherId: string; templateId: string; metricKey: string;
  value: number; effectiveFrom: string; note?: string;
}) => apiFetch<Baseline>(`/manage/clients/${clientSlug}/baselines/${id}`, { method: 'PATCH', body });
export const deleteBaseline = (clientSlug: string, id: string) =>
  apiFetch<void>(`/manage/clients/${clientSlug}/baselines/${id}`, { method: 'DELETE' });
