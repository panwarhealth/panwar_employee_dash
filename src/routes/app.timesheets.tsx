import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import type { TsLevel } from '@/api/timesheets';
import { useTsViewer } from '@/hooks/useTimesheets';
import '@/components/timesheets/timesheets.css';

export const Route = createFileRoute('/app/timesheets')({
  component: TimesheetsLayout,
});

const TABS: { to: string; label: string; exact: boolean; min: TsLevel[] }[] = [
  {
    to: '/app/timesheets',
    label: 'Timesheet',
    exact: true,
    min: ['Member', 'Manager', 'Admin'],
  },
  {
    to: '/app/timesheets/schedule',
    label: 'Schedule',
    exact: false,
    min: ['Manager', 'Admin'],
  },
  {
    to: '/app/timesheets/jobs',
    label: 'Jobs',
    exact: false,
    min: ['Manager', 'Admin'],
  },
  { to: '/app/timesheets/team', label: 'Team', exact: false, min: ['Admin'] },
  {
    to: '/app/timesheets/clients',
    label: 'Clients',
    exact: false,
    min: ['Manager', 'Admin'],
  },
  {
    to: '/app/timesheets/tasks',
    label: 'Tasks',
    exact: false,
    min: ['Manager', 'Admin'],
  },
  {
    to: '/app/timesheets/reports',
    label: 'Reports',
    exact: false,
    min: ['Member', 'Manager', 'Admin'],
  },
];

function TimesheetsLayout() {
  const viewer = useTsViewer();
  const level = viewer.data?.level;

  return (
    <div className="ts ts-page">
      <div className="wrap">
        <div className="tool">Timesheets</div>
        <nav className="tabs">
          {level &&
            TABS.filter((t) => t.min.includes(level)).map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: t.exact, includeSearch: false }}
                activeProps={{ className: 'on' }}
              >
                {t.label}
              </Link>
            ))}
        </nav>
        {viewer.isError && <p className="err">Timesheets couldn't load. Refresh to try again.</p>}
        {level && <Outlet />}
      </div>
    </div>
  );
}
