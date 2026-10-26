import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { createCourse } from '@/api/courses';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/edm/Notice';
import { ScreensPicker, PassMarkField } from '@/components/courses/CourseSettingsFields';
import { newDoc, type Screens } from '@/course/doc';
import { labelClass } from '@/lib/edm';

export const Route = createFileRoute('/app/courses/new')({
  component: NewCoursePage,
});

function NewCoursePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [screens, setScreens] = useState<Screens>('both');
  const [passMark, setPassMark] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: () => createCourse(newDoc(title.trim(), screens, passMark)),
    onSuccess: (c) => navigate({ to: '/app/courses/$courseId', params: { courseId: c.id } }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-8 sm:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ph-purple">
          Course editor - new course
        </p>
        <h1 className="text-2xl font-bold leading-tight text-ph-charcoal">Set up the course</h1>
        <p className="mb-6 mt-1 text-ph-charcoal/60">
          You can change any of this later from the course settings.
        </p>

        <label className="mb-6 block">
          <span className={labelClass}>Course title</span>
          <Input
            className="h-11 text-base"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>

        <div className="mb-6">
          <span className={labelClass}>Which screens are you building for?</span>
          <ScreensPicker value={screens} onChange={setScreens} />
        </div>

        <div className="mb-8">
          <PassMarkField value={passMark} onChange={setPassMark} />
        </div>

        {create.isError && (
          <Notice tone="error" className="mb-4">
            {create.error.message}
          </Notice>
        )}

        <div className="flex items-center gap-5">
          <Button
            size="lg"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Start building'}
          </Button>
          <Link
            to="/app/courses"
            className="text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
          >
            Cancel
          </Link>
        </div>
      </Card>
    </div>
  );
}
