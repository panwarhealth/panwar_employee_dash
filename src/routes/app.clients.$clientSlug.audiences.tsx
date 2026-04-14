import { createFileRoute } from '@tanstack/react-router';
import { NamedEntityTab } from '@/components/manage/NamedEntityTab';
import { createAudience, deleteAudience, listAudiences } from '@/api/taxonomy';

export const Route = createFileRoute('/app/clients/$clientSlug/audiences')({
  component: AudiencesTab,
});

function AudiencesTab() {
  const { clientSlug } = Route.useParams();
  return (
    <NamedEntityTab
      entityLabel="audience"
      entityPluralLabel="audiences"
      queryKey={['manage', 'clients', clientSlug, 'audiences']}
      list={() => listAudiences(clientSlug)}
      create={(body) => createAudience(clientSlug, body)}
      remove={(id) => deleteAudience(clientSlug, id)}
    />
  );
}
