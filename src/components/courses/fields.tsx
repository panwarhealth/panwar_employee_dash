import { useRef, useState, type ReactNode } from 'react';
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
