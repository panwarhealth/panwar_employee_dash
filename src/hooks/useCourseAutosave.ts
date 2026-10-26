import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { saveCourse } from '@/api/courses';
import type { CourseDoc } from '@/course/doc';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export function useCourseAutosave(courseId: string, doc: CourseDoc): SaveState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SaveState>('saved');
  const loaded = useRef(doc);

  useEffect(() => {
    if (doc === loaded.current) return;
    setState('unsaved');
    const t = setTimeout(() => {
      setState('saving');
      saveCourse(courseId, doc)
        .then(() => {
          setState('saved');
          void queryClient.invalidateQueries({ queryKey: ['courses'] });
        })
        .catch(() => setState('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [doc, courseId, queryClient]);

  useEffect(() => {
    if (state === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  return state;
}
