import { createFileRoute } from '@tanstack/react-router';
import { NamedEntityTab } from '@/components/manage/NamedEntityTab';
import { createBrand, deleteBrand, listBrands } from '@/api/taxonomy';

export const Route = createFileRoute('/app/clients/$clientSlug/brands')({
  component: BrandsTab,
});

function BrandsTab() {
  const { clientSlug } = Route.useParams();
  return (
    <NamedEntityTab
      entityLabel="brand"
      entityPluralLabel="brands"
      queryKey={['manage', 'clients', clientSlug, 'brands']}
      list={() => listBrands(clientSlug)}
      create={(body) => createBrand(clientSlug, body)}
      remove={(id) => deleteBrand(clientSlug, id)}
    />
  );
}
