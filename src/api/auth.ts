import { apiFetch } from './client';

/**
 * Mirrors the API's MeResponse shape (Panwar.Api.Models.DTOs).
 *
 * For employee users `type === 'employee'`, `clientId` is null (employees aren't
 * scoped to a single client), and `roles` carries their portal roles mapped from
 * Entra ID group membership: e.g. `panwar-admin`, `panwar-dashboard-editor`,
 * `panwar-dashboard-viewer`.
 */
export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  type: 'client' | 'employee';
  clientId: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  clientPrimaryColor: string | null;
  clientAccentColor: string | null;
  roles: string[];
}

export async function getMe(): Promise<MeResponse> {
  return apiFetch('/auth/me');
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}
