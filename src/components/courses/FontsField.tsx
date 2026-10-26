import { uid, type CourseDoc } from '@/course/doc';
import { labelClass } from '@/lib/edm';
import { MediaInput } from './fields';

export function FontsField({
  doc,
  courseId,
  onChange,
}: {
  doc: CourseDoc;
  courseId: string;
  onChange: (update: (d: CourseDoc) => void) => void;
}) {
  return (
    <div>
      <span className={labelClass}>Uploaded fonts</span>
      <p className="mb-2 text-xs text-ph-charcoal/60">
        Upload a woff2, woff or ttf file to use it in any text. It's bundled into the zip, so it
        shows on every LMS. Check you have the licence to embed it.
      </p>
      {doc.fonts.length > 0 && (
        <ul className="mb-2 divide-y divide-ph-charcoal/10 rounded-md border border-ph-charcoal/10">
          {doc.fonts.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2">
              <input
                className="min-w-0 flex-1 rounded border border-ph-charcoal/15 px-2 py-1 text-sm"
                value={f.name}
                style={{ fontFamily: `'${f.name.replace(/[^A-Za-z0-9 _-]/g, '')}', sans-serif` }}
                onChange={(e) =>
                  onChange((d) => (d.fonts.find((x) => x.id === f.id)!.name = e.target.value))
                }
              />
              <span className="truncate text-xs text-ph-charcoal/50">{f.fileName}</span>
              <button
                type="button"
                className="text-sm text-red-700 underline underline-offset-4"
                onClick={() => onChange((d) => (d.fonts = d.fonts.filter((x) => x.id !== f.id)))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <MediaInput
        label=""
        courseId={courseId}
        value=""
        fileName=""
        accept=".woff2,.woff,.ttf"
        onChange={(url, file) =>
          onChange((d) =>
            d.fonts.push({
              id: uid(),
              name: file.name.replace(/\.(woff2?|ttf)$/i, '').replace(/[-_]+/g, ' '),
              src: url,
              fileName: file.name,
            }),
          )
        }
      />
    </div>
  );
}
