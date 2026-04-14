import { apiFetch } from './client';

export interface ManagedClient {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  userCount: number;
}

export interface ClientUser {
  id: string;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateClientPayload {
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export async function listClients(): Promise<ManagedClient[]> {
  const res = await apiFetch<{ clients: ManagedClient[] }>('/manage/clients');
  return res.clients;
}

export async function createClient(payload: CreateClientPayload): Promise<ManagedClient> {
  return apiFetch('/manage/clients', { method: 'POST', body: payload });
}

export async function listClientUsers(clientSlug: string): Promise<ClientUser[]> {
  const res = await apiFetch<{ users: ClientUser[] }>(
    `/manage/clients/${encodeURIComponent(clientSlug)}/users`,
  );
  return res.users;
}

export async function addClientUser(
  clientSlug: string,
  payload: { email: string; name?: string },
): Promise<ClientUser> {
  return apiFetch(`/manage/clients/${encodeURIComponent(clientSlug)}/users`, {
    method: 'POST',
    body: payload,
  });
}

export async function removeClientUser(clientSlug: string, userId: string): Promise<void> {
  await apiFetch(
    `/manage/clients/${encodeURIComponent(clientSlug)}/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}
