import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useHasRole } from '@/hooks/useAuth';
import {
  getAdminUsers,
  assignRole,
  removeRole,
  type GraphUser,
} from '@/api/admin';

export const Route = createFileRoute('/app/admin')({
  component: AdminPage,
});

const AVAILABLE_ROLES = [
  { value: 'panwar-admin', label: 'Admin' },
  { value: 'dashboard-editor', label: 'Dashboard Editor' },
  { value: 'medical-writer', label: 'Medical Writer' },
];

function AdminPage() {
  const isAdmin = useHasRole('panwar-admin');

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Users & Roles</h1>
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-ph-charcoal/60">
              You don't have permission to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminContent />;
}

function AdminContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getAdminUsers,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ph-charcoal">Users & Roles</h1>
      <p className="mt-1 text-sm text-ph-charcoal/60">
        Manage employee access and role assignments via Entra ID.
      </p>

      {data?.secretExpiry && <SecretExpiryBanner expiry={data.secretExpiry} />}

      <Card className="mt-6">
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-ph-charcoal/60">Loading users...</p>
          )}
          {error && (
            <p className="text-sm text-red-600">
              Failed to load users. Make sure Graph API admin consent has been granted.
            </p>
          )}
          {data && <UserTable users={data.users} />}
        </CardContent>
      </Card>
    </div>
  );
}

function SecretExpiryBanner({ expiry }: { expiry: string }) {
  const expiryDate = new Date(expiry);
  const now = new Date();
  const daysUntil = Math.floor(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntil > 30) return null;

  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-medium text-amber-800">
          {daysUntil <= 0
            ? 'Client secret has expired!'
            : `Client secret expires in ${daysUntil} days (${expiry})`}
        </p>
        <p className="mt-1 text-xs text-amber-700">
          To renew: Azure Portal → Microsoft Entra ID → App registrations →
          Panwar Portals - Employee SSO → Certificates & secrets → New client
          secret. Then update the <code>ENTRA_CLIENT_SECRET</code> app setting in
          the panwar-api Function App and set the new{' '}
          <code>ENTRA_CLIENT_SECRET_EXPIRY</code> date.
        </p>
      </div>
    </div>
  );
}

function UserTable({ users }: { users: GraphUser[] }) {
  const sorted = [...users].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-ph-charcoal/60">No users found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ph-charcoal/10 text-left">
            <th className="pb-3 pr-4 font-medium text-ph-charcoal/60">Name</th>
            <th className="pb-3 pr-4 font-medium text-ph-charcoal/60">Email</th>
            <th className="pb-3 font-medium text-ph-charcoal/60">Roles</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user }: { user: GraphUser }) {
  const queryClient = useQueryClient();

  const assign = useMutation({
    mutationFn: ({ role }: { role: string }) => assignRole(user.id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const remove = useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string }) => removeRole(assignmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const activeRoleValues = new Set(user.roles.map((r) => r.roleValue));
  const isPending = assign.isPending || remove.isPending;

  return (
    <tr className="border-b border-ph-charcoal/5">
      <td className="py-3 pr-4 font-medium text-ph-charcoal">
        {user.displayName}
      </td>
      <td className="py-3 pr-4 text-ph-charcoal/60">{user.email}</td>
      <td className="py-3">
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_ROLES.map((role) => {
            const active = activeRoleValues.has(role.value);
            const assignment = user.roles.find((r) => r.roleValue === role.value);
            return (
              <Button
                key={role.value}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-7 text-xs"
                disabled={isPending}
                onClick={() => {
                  if (active && assignment) {
                    remove.mutate({ assignmentId: assignment.assignmentId });
                  } else {
                    assign.mutate({ role: role.value });
                  }
                }}
              >
                {role.label}
              </Button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}
