import { apiFetch } from './client';

export interface GraphRoleAssignment {
  assignmentId: string;
  roleValue: string;
  roleDisplayName: string;
}

export interface GraphUser {
  id: string;
  displayName: string;
  email: string;
  roles: GraphRoleAssignment[];
}

export interface AdminUsersResponse {
  users: GraphUser[];
  secretExpiry: string | null;
}

export async function getAdminUsers(): Promise<AdminUsersResponse> {
  return apiFetch('/manage/users');
}

export async function assignRole(userId: string, role: string): Promise<{ assignmentId: string }> {
  return apiFetch(`/manage/users/${userId}/roles`, {
    method: 'POST',
    body: { role },
  });
}

export async function removeRole(assignmentId: string): Promise<void> {
  await apiFetch(`/manage/users/roles/${assignmentId}`, {
    method: 'DELETE',
  });
}
