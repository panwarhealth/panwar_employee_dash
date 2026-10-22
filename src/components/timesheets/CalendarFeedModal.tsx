import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ts } from '@/api/timesheets';
import { errorText } from '@/hooks/useTimesheets';
import { TsModal } from './TsModal';

export function CalendarFeedModal({ onClose }: { onClose: () => void }) {
  const feed = useQuery({ queryKey: ['ts', 'calendar-feed'], queryFn: ts.calendarFeed });
  const [copied, setCopied] = useState(false);

  return (
    <TsModal onClose={onClose}>
      <div className="tool">My calendar feed</div>
      <p className="hint" style={{ margin: '8px 0 16px' }}>
        Subscribe to this link to see your bookings in Outlook or Google Calendar. It updates on its
        own. Keep it private. Anyone with the link can see your schedule.
      </p>
      {feed.error && <p className="err">{errorText(feed.error)}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="inp"
          style={{ flex: 1, minWidth: 0 }}
          readOnly
          value={feed.data ?? 'Loading...'}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="btn"
          disabled={!feed.data}
          onClick={async () => {
            await navigator.clipboard.writeText(feed.data!);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 16 }}>
        Outlook: Add calendar, then Subscribe from web, and paste the link.
        <br />
        Google Calendar: Other calendars, then From URL, and paste the link.
      </p>
      <div className="mfoot">
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
    </TsModal>
  );
}
