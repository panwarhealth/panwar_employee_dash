import { Modal } from '@/components/ui/modal';
import type { CourseDoc } from '@/course/doc';
import { labelClass } from '@/lib/edm';
import { PassMarkField, ScreensPicker } from './CourseSettingsFields';
import { FontsField } from './FontsField';
import { Toggle } from './fields';

export function SettingsModal({
  open,
  onClose,
  doc,
  courseId,
  onChange,
}: {
  open: boolean;
  courseId: string;
  onClose: () => void;
  doc: CourseDoc;
  onChange: (update: (d: CourseDoc) => void) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Course settings" className="max-w-xl">
      <div className="flex flex-col gap-6 px-6 py-5">
        <label className="block">
          <span className={labelClass}>Course title</span>
          <input
            className="h-11 w-full rounded-md border border-ph-charcoal/20 px-3 text-base"
            value={doc.title}
            onChange={(e) => onChange((d) => (d.title = e.target.value))}
          />
        </label>
        <div>
          <span className={labelClass}>Which screens are you building for?</span>
          <ScreensPicker value={doc.screens} onChange={(v) => onChange((d) => (d.screens = v))} />
        </div>
        <PassMarkField value={doc.passMark} onChange={(v) => onChange((d) => (d.passMark = v))} />
        <Toggle
          label="Show a Back and Continue bar at the bottom of every page"
          checked={!!doc.navBar}
          onChange={(v) => onChange((d) => (d.navBar = v))}
        />
        <FontsField doc={doc} courseId={courseId} onChange={onChange} />
        <label className="flex items-center gap-3">
          <span className={labelClass + ' mb-0'}>Accent colour</span>
          <input
            type="color"
            value={doc.accent}
            onChange={(e) => onChange((d) => (d.accent = e.target.value))}
            className="h-9 w-14 cursor-pointer rounded border border-ph-charcoal/20"
          />
        </label>
      </div>
    </Modal>
  );
}
