import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Inbox view — unread client comments and unapproved month snapshots across
 * all clients, sorted by priority. The first thing an editor opens in the
 * morning. Stub for now.
 */
export const Route = createFileRoute('/app/inbox')({
  component: InboxPage,
});

function InboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ph-charcoal">Inbox</h1>
        <p className="mt-1 text-sm text-ph-charcoal/70">
          Unread client comments and unapproved months across all clients.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            Lands with Phase 3 — the comments / month-snapshot / publish / approve workflow.
            This is the page editors live in.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
