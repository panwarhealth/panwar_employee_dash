import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ts } from '@/api/timesheets';
import { JobForm } from '@/components/timesheets/JobForm';

interface NewJobSearch {
  from?: string;
}

export const Route = createFileRoute('/app/timesheets/jobs/new')({
  validateSearch: (search: Record<string, unknown>): NewJobSearch => ({
    from:
      typeof search.from === 'string' && /^[0-9a-f-]{36}$/i.test(search.from)
        ? search.from
        : undefined,
  }),
  component: NewJobPage,
});

function NewJobPage() {
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  const source = useQuery({
    queryKey: ['ts', 'job', from, 'all'],
    queryFn: () => ts.job(from!),
    enabled: !!from,
  });
  if (from && !source.data) return null;

  return (
    <>
      <Link className="back" to="/app/timesheets/jobs">
        &larr; Back to Jobs
      </Link>
      <h1 className="jt1" style={{ margin: '4px 0 18px' }}>
        {from ? 'Duplicate job' : 'New job'}
      </h1>
      <JobForm
        job={null}
        copyOf={source.data ?? null}
        onSaved={(job) =>
          navigate({
            to: '/app/timesheets/jobs/$jobId',
            params: { jobId: job.id },
          })
        }
        onCancel={() => navigate({ to: '/app/timesheets/jobs' })}
      />
    </>
  );
}
