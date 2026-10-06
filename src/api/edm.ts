import { apiDownload, apiFetch } from './client';

// ---- senders ----

export interface EdmSender {
  id: string;
  name: string;
  fromAddress: string;
  replyTo: string | null;
  brandColour: string;
  logoUrl: string | null;
  footerText: string;
}

/** Only branding is editable: the name and address mirror the sender set up in Azure. */
export type EdmSenderBranding = Pick<
  EdmSender,
  'replyTo' | 'brandColour' | 'logoUrl' | 'footerText'
>;

export const listSenders = (): Promise<EdmSender[]> =>
  apiFetch<{ senders: EdmSender[] }>('/edm/senders').then((r) => r.senders);

export const updateSenderBranding = (id: string, body: EdmSenderBranding): Promise<EdmSender> =>
  apiFetch(`/edm/senders/${id}`, { method: 'PUT', body });

// ---- lists ----

export type EdmSyncSource = 'PharmaChat' | 'ClinicalStudio';

export interface EdmList {
  id: string;
  name: string;
  kind: 'Custom' | 'Synced';
  syncSource: EdmSyncSource | null;
  sender: EdmSender;
  subscribed: number;
  unsubscribed: number;
  bounced: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface EdmListBody {
  name: string;
  senderId: string;
}

export type EdmContactStatus = 'Subscribed' | 'Unsubscribed' | 'Bounced';

export interface EdmContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: EdmContactStatus;
  statusChangedAt: string | null;
  createdAt: string;
}

export interface EdmContactPage {
  contacts: EdmContact[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EdmContactBody {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface EdmImportResult {
  added: number;
  updated: number;
  removed: number;
  suppressed: number;
  invalid: number;
  invalidSamples: string[];
}

export interface EdmSyncResult {
  added: number;
  updated: number;
  unsubscribed: number;
  writtenBack: number;
  error: string | null;
}

export const listLists = (): Promise<EdmList[]> =>
  apiFetch<{ lists: EdmList[] }>('/edm/lists').then((r) => r.lists);

export const getList = (id: string): Promise<EdmList> => apiFetch(`/edm/lists/${id}`);

export const createList = (body: EdmListBody): Promise<EdmList> =>
  apiFetch('/edm/lists', { method: 'POST', body });

export const updateList = (id: string, body: EdmListBody): Promise<EdmList> =>
  apiFetch(`/edm/lists/${id}`, { method: 'PUT', body });

export const deleteList = (id: string): Promise<void> =>
  apiFetch(`/edm/lists/${id}`, { method: 'DELETE' });

export const syncList = (id: string): Promise<EdmSyncResult> =>
  apiFetch(`/edm/lists/${id}/sync`, { method: 'POST' });

export const listContacts = (
  id: string,
  params: { search: string; status: string; page: number },
): Promise<EdmContactPage> => {
  const q = new URLSearchParams({ page: String(params.page) });
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  return apiFetch(`/edm/lists/${id}/contacts?${q}`);
};

export const addContact = (listId: string, body: EdmContactBody): Promise<EdmContact> =>
  apiFetch(`/edm/lists/${listId}/contacts`, { method: 'POST', body });

export const setContactStatus = (
  listId: string,
  contactId: string,
  status: 'subscribed' | 'unsubscribed',
): Promise<EdmContact> =>
  apiFetch(`/edm/lists/${listId}/contacts/${contactId}`, {
    method: 'PATCH',
    body: { status },
  });

export const importContacts = (
  listId: string,
  contacts: EdmContactBody[],
  mode: 'add' | 'replace',
): Promise<EdmImportResult> =>
  apiFetch(`/edm/lists/${listId}/import`, {
    method: 'POST',
    body: { contacts, mode },
  });

// ---- campaigns ----

export type EdmCampaignStatus = 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Cancelled';

export interface EdmCampaignStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  opened: number;
  unsubscribed: number;
}

export interface EdmCampaignSummary {
  id: string;
  name: string;
  campaignCode: string | null;
  status: EdmCampaignStatus;
  listName: string | null;
  listSize: number | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  createdByName: string;
  stats: EdmCampaignStats;
}

export interface EdmContentAnalysis {
  htmlBytes: number;
  linkCount: number;
  imageCount: number;
  hasTextVersion: boolean;
  hasUnsubscribeTag: boolean;
  linksMissingUtm: string[];
  missingImages: string[];
  warnings: string[];
}

export interface EdmCampaign {
  id: string;
  name: string;
  campaignCode: string | null;
  status: EdmCampaignStatus;
  listId: string | null;
  listName: string | null;
  senderId: string | null;
  sender: EdmSender | null;
  subject: string | null;
  previewText: string | null;
  sourceFileName: string | null;
  content: EdmContentAnalysis | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdByName: string;
  sentByName: string | null;
  createdAt: string;
  updatedAt: string;
  stats: EdmCampaignStats;
}

export interface EdmCampaignPatch {
  name?: string;
  campaignCode?: string;
  listId?: string;
  senderId?: string;
  subject?: string;
  previewText?: string;
}

export interface EdmPreviewRecipient {
  contactId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface EdmPreview {
  html: string;
  subject: string;
  recipient: EdmPreviewRecipient;
  samples: EdmPreviewRecipient[];
}

export interface EdmAudience {
  listName: string;
  listTotal: number;
  sendable: number;
  skipped: number;
}

export interface EdmReportRow {
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  at: string | null;
  detail: string | null;
}

export interface EdmReport {
  campaign: EdmCampaign;
  bounces: EdmReportRow[];
  unsubscribes: EdmReportRow[];
  failures: EdmReportRow[];
}

export const listCampaigns = (): Promise<EdmCampaignSummary[]> =>
  apiFetch<{ campaigns: EdmCampaignSummary[] }>('/edm/campaigns').then((r) => r.campaigns);

export const getCampaign = (id: string): Promise<EdmCampaign> => apiFetch(`/edm/campaigns/${id}`);

export const createCampaign = (listId?: string): Promise<EdmCampaign> =>
  apiFetch('/edm/campaigns', { method: 'POST', body: { listId } });

export const updateCampaign = (id: string, body: EdmCampaignPatch): Promise<EdmCampaign> =>
  apiFetch(`/edm/campaigns/${id}`, { method: 'PATCH', body });

export const deleteCampaign = (id: string): Promise<void> =>
  apiFetch(`/edm/campaigns/${id}`, { method: 'DELETE' });

export const uploadContent = (
  id: string,
  file: File,
): Promise<{
  campaign: EdmCampaign;
  detectedSubject: string | null;
  detectedPreviewText: string | null;
}> =>
  apiFetch(`/edm/campaigns/${id}/content?filename=${encodeURIComponent(file.name)}`, {
    method: 'PUT',
    body: file,
  });

export const previewCampaign = (id: string, contactId?: string | null): Promise<EdmPreview> =>
  apiFetch(`/edm/campaigns/${id}/preview${contactId ? `?contactId=${contactId}` : ''}`);

export const getAudience = (id: string): Promise<EdmAudience> =>
  apiFetch(`/edm/campaigns/${id}/audience`);

export const sendTest = (id: string, emails: string[]): Promise<{ sentTo: string[] }> =>
  apiFetch(`/edm/campaigns/${id}/test`, { method: 'POST', body: { emails } });

/** scheduleAt is Sydney wall-clock "yyyy-MM-ddTHH:mm"; omit to send now. */
export const sendCampaign = (
  id: string,
  confirmCount: number,
  scheduleAt?: string,
): Promise<EdmCampaign> =>
  apiFetch(`/edm/campaigns/${id}/send`, {
    method: 'POST',
    body: { confirmCount, scheduleAt },
  });

export const cancelCampaign = (id: string): Promise<EdmCampaign> =>
  apiFetch(`/edm/campaigns/${id}/cancel`, { method: 'POST' });

export const duplicateCampaign = (id: string): Promise<EdmCampaign> =>
  apiFetch(`/edm/campaigns/${id}/duplicate`, { method: 'POST' });

export const getReport = (id: string): Promise<EdmReport> =>
  apiFetch(`/edm/campaigns/${id}/report`);

export const downloadReportCsv = (id: string, name: string): Promise<void> =>
  apiDownload(`/edm/campaigns/${id}/report.csv`, `${name.replace(/[^\w-]+/g, '_')}_report.csv`);
