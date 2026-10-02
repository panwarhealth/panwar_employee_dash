import { apiFetch } from './client';

export interface TrackedLink {
  id: string;
  destinationUrl: string;
  campaignId: string;
  clientName: string | null;
  source: string;
  medium: string;
  content: string | null;
  url: string;
  createdByName: string;
  createdAt: string;
}

export interface QrCodeOptions {
  size: number;
  foreground: string;
  background: string;
  hasLogo: boolean;
}

export interface SavedQrCode extends QrCodeOptions {
  id: string;
  url: string;
  createdByName: string;
  createdAt: string;
}

export interface CreateLinkBody {
  destinationUrl: string;
  campaignId: string;
  source: string;
  medium: string;
}

export const listLinks = (): Promise<TrackedLink[]> =>
  apiFetch<{ links: TrackedLink[] }>('/links').then((r) => r.links);

export const createLink = (body: CreateLinkBody): Promise<TrackedLink> =>
  apiFetch('/links', { method: 'POST', body });

export const setLinkContent = (id: string, content: string): Promise<TrackedLink> =>
  apiFetch(`/links/${id}`, { method: 'PATCH', body: { content } });

export interface JobClient {
  prefix: string;
  name: string;
}

export const listJobClients = (): Promise<JobClient[]> =>
  apiFetch<{ clients: JobClient[] }>('/job-clients').then((r) => r.clients);

export const listQrCodes = (): Promise<SavedQrCode[]> =>
  apiFetch<{ codes: SavedQrCode[] }>('/qr-codes').then((r) => r.codes);

export const saveQrCode = (body: QrCodeOptions & { url: string }): Promise<SavedQrCode> =>
  apiFetch('/qr-codes', { method: 'POST', body });
