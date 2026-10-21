import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ts } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { JobForm } from '@/components/timesheets/JobForm';

export const Route = createFileRoute('/app/timesheets/jobs/$jobId/edit')({
  component: EditJobPage,
});

function EditJobPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const job = useQuery({
    queryKey: ['ts', 'job', jobId, 'all'],
    queryFn: () => ts.job(jobId),
  });
  const back = () => navigate({ to: '/app/timesheets/jobs/$jobId', params: { jobId } });

  return (
    <>
      <Link className="back" to="/app/timesheets/jobs/$jobId" params={{ jobId }}>
        &larr; Back to job
      </Link>
      <h1 className="jt1" style={{ margin: '4px 0 18px' }}>
        Edit job
      </h1>
      {job.error && <p className="err">{errorText(job.error)}</p>}
      {job.data && <JobForm job={job.data} onSaved={back} onCancel={back} />}
    </>
  );
}
