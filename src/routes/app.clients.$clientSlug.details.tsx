import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/api/client';
import {
  addClientUser,
  listClientUsers,
  removeClientUser,
  type ClientUser,
} from '@/api/clients';

export const Route = createFileRoute('/app/clients/$clientSlug/details')({
  component: DetailsTab,
});

function DetailsTab() {
  const { clientSlug } = Route.useParams();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['manage', 'clients', clientSlug, 'users'],
    queryFn: () => listClientUsers(clientSlug),
  });

  return (
    <div className="flex flex-col gap-6">
      <AddUserCard clientSlug={clientSlug} />
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold text-ph-charcoal">Users with access</h2>
          <p className="mt-1 text-sm text-ph-charcoal/60">
            Client users who can sign in and view this client&rsquo;s dashboards.
          </p>
          {isLoading && <p className="mt-3 text-sm text-ph-charcoal/60">Loading…</p>}
          {!isLoading && users.length === 0 && (
            <p className="mt-3 text-sm text-ph-charcoal/60">
              No users yet — add an email above to grant access.
            </p>
          )}
          {users.length > 0 && <UserList users={users} clientSlug={clientSlug} />}
        </CardContent>
      </Card>
    </div>
  );
}

function UserList({ users, clientSlug }: { users: ClientUser[]; clientSlug: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (userId: string) => removeClientUser(clientSlug, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'users'] }),
  });

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ph-charcoal/10 text-xs uppercase tracking-wide text-ph-charcoal/60">
          <tr>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Last login</th>
            <th className="py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-ph-charcoal/5 last:border-0">
              <td className="py-2 pr-4 font-medium text-ph-charcoal">{u.email}</td>
              <td className="py-2 pr-4 text-ph-charcoal/80">{u.name ?? '—'}</td>
              <td className="py-2 pr-4 text-ph-charcoal/60">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-AU') : 'Never'}
              </td>
              <td className="py-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Revoke access for ${u.email}?`)) remove.mutate(u.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Revoke
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const addUserSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  name: z.string().optional(),
});
type AddUserValues = z.infer<typeof addUserSchema>;

function AddUserCard({ clientSlug }: { clientSlug: string }) {
  const queryClient = useQueryClient();
  const form = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: '', name: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: AddUserValues) =>
      addClientUser(clientSlug, {
        email: values.email,
        name: values.name?.trim() ? values.name.trim() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients', clientSlug, 'users'] });
      queryClient.invalidateQueries({ queryKey: ['manage', 'clients'] });
      form.reset();
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-base font-semibold text-ph-charcoal">Grant access</h2>
        <p className="mt-1 text-sm text-ph-charcoal/60">
          Enter a client user&rsquo;s email. If they don&rsquo;t exist yet, we&rsquo;ll create
          the account so they can sign in via magic link.
        </p>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="flex flex-col gap-1.5">
            <Input placeholder="client@company.com" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input placeholder="Name (optional)" {...form.register('name')} />
          </div>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Adding…' : 'Add user'}
          </Button>
          {error && <p className="col-span-full text-xs text-red-600">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
