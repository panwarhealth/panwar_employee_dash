import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bold, Italic, Link2, List, ListOrdered } from 'lucide-react';
import { uploadMedia } from '@/api/courses';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2.5 py-2 text-sm text-ph-charcoal focus:border-ph-purple focus:outline-none';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        className={cn(inputClass, 'min-h-[80px] resize-y')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ph-charcoal">
      <input
        type="checkbox"
        className="h-4 w-4 accent-ph-purple"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function RichText({
  label,
  html,
  onChange,
}: {
  label: string;
  html: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef(html);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial.current;
  }, []);

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const tools: { icon: ReactNode; title: string; act: () => void }[] = [
    {
      icon: <Bold className="h-3.5 w-3.5" />,
      title: 'Bold',
      act: () => run('bold'),
    },
    {
      icon: <Italic className="h-3.5 w-3.5" />,
      title: 'Italic',
      act: () => run('italic'),
    },
    {
      icon: <Link2 className="h-3.5 w-3.5" />,
      title: 'Link',
      act: () => {
        const url = window.prompt('Link address (https://...)');
        if (url) run('createLink', url);
      },
    },
    {
      icon: <List className="h-3.5 w-3.5" />,
      title: 'Bullet list',
      act: () => run('insertUnorderedList'),
    },
    {
      icon: <ListOrdered className="h-3.5 w-3.5" />,
      title: 'Numbered list',
      act: () => run('insertOrderedList'),
    },
  ];

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">{label}</span>
      <div className="rounded-md border-[1.5px] border-ph-charcoal/15 bg-white focus-within:border-ph-purple">
        <div className="flex gap-1 border-b border-ph-charcoal/10 px-1.5 py-1">
          {tools.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.act}
              className="rounded p-1.5 text-ph-charcoal/70 hover:bg-ph-charcoal/5 hover:text-ph-purple"
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          className="min-h-[110px] px-2.5 py-2 text-sm text-ph-charcoal focus:outline-none [&_a]:text-ph-purple [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  );
}

export function MediaInput({
  label,
  courseId,
  value,
  fileName,
  accept,
  onChange,
}: {
  label: string;
  courseId: string;
  value: string;
  fileName: string;
  accept: string;
  onChange: (url: string, file: File) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await uploadMedia(courseId, file);
      onChange(url, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ph-charcoal/60">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-3 py-1.5 text-sm font-medium text-ph-charcoal hover:border-ph-purple hover:text-ph-purple disabled:opacity-50"
        >
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {value && !busy && (
          <span className="min-w-0 truncate text-xs text-ph-charcoal/60">
            {fileName || 'Uploaded'}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void pick(f);
        }}
      />
    </div>
  );
}
