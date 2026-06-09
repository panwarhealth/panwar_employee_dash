import { apiFetch } from './client';

export interface PlacementKpi {
  metricKey: string;
  targetValue: number;
}

export interface PlacementActual {
  year: number;
  month: number;
  metricKey: string;
  value: number;
  note: string | null;
}

/** Lightweight row for the card/table grid. */
export interface PlacementListItem {
  id: string;
  brandId: string;
  brandName: string;
  audienceId: string;
  audienceName: string;
  publisherId: string;
  publisherName: string;
  templateId: string;
  templateCode: string;
  name: string;
  objective: string;
  assetType: string | null;
  creativeCode: string | null;
  osCode: string | null;
  artworkUrl: string | null;
  liveMonths: number[];
  mediaCost: number;
  plannedMediaCost: number | null;
  cpdInvestmentCost: number | null;
  isBonus: boolean;
  isCpdPackage: boolean;
}

/** Full placement for the edit form. */
export interface PlacementDetail extends PlacementListItem {
  templateName: string;
  utmUrl: string | null;
  artworkViewUrl: string | null;
  comments: string | null;
  notes: string | null;
  circulation: number | null;
  placementsCount: number | null;
  targetCourseId: string | null;
  kpis: PlacementKpi[];
  actuals: PlacementActual[];
}

export interface PlacementWriteBody {
  brandId: string;
  audienceId: string;
  publisherId: string;
  templateId: string;
  name: string;
  objective: string;
  assetType?: string | null;
  creativeCode?: string | null;
  osCode?: string | null;
  utmUrl?: string | null;
  artworkUrl?: string | null;
  comments?: string | null;
  notes?: string | null;
  liveMonths: number[];
  mediaCost: number;
  plannedMediaCost?: number | null;
  cpdInvestmentCost?: number | null;
  isBonus: boolean;
  isCpdPackage: boolean;
  circulation?: number | null;
  placementsCount?: number | null;
  targetCourseId?: string | null;
}

export interface ArtworkUploadUrl {
  uploadUrl: string;
  objectKey: string;
}

interface ListFilters {
  brandId?: string;
  audienceId?: string;
  publisherId?: string;
}

export const listPlacements = (clientSlug: string, filters: ListFilters = {}): Promise<PlacementListItem[]> => {
  const params = new URLSearchParams();
  if (filters.brandId) params.set('brandId', filters.brandId);
  if (filters.audienceId) params.set('audienceId', filters.audienceId);
  if (filters.publisherId) params.set('publisherId', filters.publisherId);
  const qs = params.toString();
  return apiFetch<{ placements: PlacementListItem[] }>(
    `/manage/clients/${clientSlug}/placements${qs ? `?${qs}` : ''}`,
  ).then((r) => r.placements);
};

export const getPlacement = (clientSlug: string, id: string): Promise<PlacementDetail> =>
  apiFetch<PlacementDetail>(`/manage/clients/${clientSlug}/placements/${id}`);

export const createPlacement = (clientSlug: string, body: PlacementWriteBody): Promise<PlacementDetail> =>
  apiFetch<PlacementDetail>(`/manage/clients/${clientSlug}/placements`, { method: 'POST', body });

export const updatePlacement = (clientSlug: string, id: string, body: PlacementWriteBody): Promise<PlacementDetail> =>
  apiFetch<PlacementDetail>(`/manage/clients/${clientSlug}/placements/${id}`, { method: 'PATCH', body });

export const deletePlacement = (clientSlug: string, id: string): Promise<void> =>
  apiFetch<void>(`/manage/clients/${clientSlug}/placements/${id}`, { method: 'DELETE' });

export const setPlacementKpis = (clientSlug: string, id: string, kpis: PlacementKpi[]): Promise<PlacementDetail> =>
  apiFetch<PlacementDetail>(`/manage/clients/${clientSlug}/placements/${id}/kpis`, {
    method: 'PUT',
    body: { kpis },
  });

export const setPlacementActuals = (
  clientSlug: string,
  id: string,
  actuals: PlacementActual[],
): Promise<PlacementDetail> =>
  apiFetch<PlacementDetail>(`/manage/clients/${clientSlug}/placements/${id}/actuals`, {
    method: 'PUT',
    body: { actuals },
  });

export const requestArtworkUploadUrl = (
  clientSlug: string,
  id: string,
  body: { fileName: string; contentType: string },
): Promise<ArtworkUploadUrl> =>
  apiFetch<ArtworkUploadUrl>(`/manage/clients/${clientSlug}/placements/${id}/artwork-upload-url`, {
    method: 'POST',
    body,
  });
