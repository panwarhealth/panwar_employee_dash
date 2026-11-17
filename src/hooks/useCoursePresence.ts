import { useEffect, useState } from 'react';
import { sendPresence, type Presence } from '@/api/courses';

const BEAT_MS = 10_000;

export function useCoursePresence(courseId: string, pageId: string): Presence[] {
  const [people, setPeople] = useState<Presence[]>([]);

  useEffect(() => {
    let live = true;
    const beat = () => {
      if (document.hidden) return;
      sendPresence(courseId, pageId)
        .then((p) => live && setPeople(p))
        .catch(() => {});
    };
    beat();
    const timer = window.setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [courseId, pageId]);

  return people;
}
