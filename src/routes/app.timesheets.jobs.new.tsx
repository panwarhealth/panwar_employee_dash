import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { JobForm } from '@/components/timesheets/JobForm';

export const Route = createFileRoute('/app/timesheets/jobs/new')({
  component: NewJobPage,
});

function NewJobPage() {
  const navigate = useNavigate();
  return (
    <>
      <Link className="back" to="/app/timesheets/jobs">
        &larr; Back to Jobs
      </Link>
      <h1 className="jt1" style={{ margin: '4px 0 18px' }}>
        New job
      </h1>
      <JobForm
        job={null}
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
