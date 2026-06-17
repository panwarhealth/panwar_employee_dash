import { apiFetch } from './client';
import { MONTHS } from './cpdInvestments';

export interface ReportInvite {
  id: string;
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string | null;
  template: string;
  year: number;
  startMonth: number | null;
  endMonth: number | null;
  sentAt: string;
  sendCount: number;
  clickedAt: string | null;
  viewedAt: string | null;
}

export type PreviewMode = 'stats' | 'note' | 'none';

export interface SendInvitesBody {
  template: string;
  year: number;
  startMonth?: number | null;
  endMonth?: number | null;
  previewMode: PreviewMode;
  previewNote?: string | null;
  recipientUserIds: string[];
}

export const INVITE_TEMPLATES = [{ value: 'report_ready', label: 'Report ready' }] as const;

export const inviteTemplateLabel = (value: string) =>
  INVITE_TEMPLATES.find((t) => t.value === value)?.label ?? value;

export function invitePeriodLabel(inv: Pick<ReportInvite, 'year' | 'startMonth' | 'endMonth'>): string {
  if (inv.startMonth == null || inv.endMonth == null) return String(inv.year);
  const name = (m: number) => MONTHS.find((x) => x.value === m)?.label ?? String(m);
  return inv.startMonth === inv.endMonth
    ? `${name(inv.startMonth)} ${inv.year}`
    : `${name(inv.startMonth)} - ${name(inv.endMonth)} ${inv.year}`;
}

export const listInvites = (clientSlug: string): Promise<{ items: ReportInvite[] }> =>
  apiFetch(`/manage/clients/${clientSlug}/invites`);

export const sendInvites = (
  clientSlug: string,
  body: SendInvitesBody,
): Promise<{ sent: number; failed: string[] }> =>
  apiFetch(`/manage/clients/${clientSlug}/invites`, { method: 'POST', body });

export const previewInvite = (
  clientSlug: string,
  body: SendInvitesBody,
): Promise<{ subject: string; html: string }> =>
  apiFetch(`/manage/clients/${clientSlug}/invites/preview`, { method: 'POST', body });
