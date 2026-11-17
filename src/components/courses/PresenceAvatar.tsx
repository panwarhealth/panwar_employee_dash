import type { Presence } from '@/api/courses';
import { cn } from '@/lib/utils';

const COLOURS = ['#702f8f', '#215f9a', '#c2185b', '#2e7d32', '#e65100', '#00838f', '#5d4037'];

function initials(name: string): string {
  const words = name.split('@')[0].split(/[\s._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function colour(id: string): string {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[n % COLOURS.length];
}

export function PresenceAvatar({
  person,
  title,
  small = false,
  onClick,
}: {
  person: Presence;
  title: string;
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      tabIndex={onClick ? undefined : -1}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white',
        small ? 'h-4 w-4 text-[8px]' : 'h-7 w-7 text-[11px]',
        !onClick && 'cursor-default',
      )}
      style={{ background: colour(person.userId) }}
    >
      {initials(person.name)}
    </button>
  );
}
