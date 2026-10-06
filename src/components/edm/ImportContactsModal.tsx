import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importContacts, type EdmImportResult } from '@/api/edm';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Notice } from './Notice';
import { parseCsv } from '@/lib/csv';
import { labelClass, num, selectClass } from '@/lib/edm';

type Field = 'email' | 'firstName' | 'lastName';

const FIELDS: { key: Field; label: string; guess: RegExp }[] = [
  { key: 'email', label: 'Email', guess: /e-?mail/i },
  {
    key: 'firstName',
    label: 'First name',
    guess: /^(first|given|fname|first.?name)/i,
  },
  {
    key: 'lastName',
    label: 'Last name',
    guess: /^(last|sur|family|lname|last.?name)/i,
  },
];

/**
 * CSV import with column mapping. Parsing happens in the browser so the person sees exactly
 * what will be imported before anything is saved; the API only receives clean rows.
 */
export function ImportContactsModal({
  listId,
  open,
  onClose,
}: {
  listId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<Field, number>>({
    email: -1,
    firstName: -1,
    lastName: -1,
  });
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [result, setResult] = useState<EdmImportResult | null>(null);
  const [parseError, setParseError] = useState('');

  const header = rows[0] ?? [];
  const body = hasHeader ? rows.slice(1) : rows;
  const columns = header.map((h, i) => (hasHeader && h.trim() ? h.trim() : `Column ${i + 1}`));

  const load = async (file: File) => {
    setResult(null);
    setParseError('');
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    if (parsed.length === 0) {
      setParseError("That file doesn't have any rows.");
      setRows([]);
      return;
    }
    setRows(parsed);
    const first = parsed[0];
    const looksLikeHeader = !first.some((f) => f.includes('@'));
    setHasHeader(looksLikeHeader);
    setMapping({
      email: looksLikeHeader
        ? first.findIndex((h) => FIELDS[0].guess.test(h))
        : first.findIndex((f) => f.includes('@')),
      firstName: looksLikeHeader ? first.findIndex((h) => FIELDS[1].guess.test(h.trim())) : -1,
      lastName: looksLikeHeader ? first.findIndex((h) => FIELDS[2].guess.test(h.trim())) : -1,
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() || null : null);
      const contacts = body.map((r) => ({
        email: cell(r, mapping.email) ?? '',
        firstName: cell(r, mapping.firstName),
        lastName: cell(r, mapping.lastName),
      }));
      return importContacts(listId, contacts, mode);
    },
    onSuccess: (r) => {
      setResult(r);
      queryClient.invalidateQueries({ queryKey: ['edm-lists'] });
      queryClient.invalidateQueries({ queryKey: ['edm-list', listId] });
      queryClient.invalidateQueries({ queryKey: ['edm-contacts', listId] });
    },
  });

  const close = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    save.reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Import contacts from CSV">
      <div className="flex flex-col gap-5 p-6">
        {result ? (
          <>
            <Notice tone="success">
              Added {num(result.added)}, updated {num(result.updated)}
              {result.removed > 0 && `, removed ${num(result.removed)}`}.
              {result.suppressed > 0 &&
                ` ${num(result.suppressed)} had already unsubscribed or bounced, so they're on the list but won't be emailed.`}
            </Notice>
            {result.invalid > 0 && (
              <Notice tone="warning">
                Skipped {num(result.invalid)} row
                {result.invalid === 1 ? '' : 's'} without a valid email
                {result.invalidSamples.length > 0 && (
                  <>
                    : {result.invalidSamples.join(', ')}
                    {result.invalid > result.invalidSamples.length && '…'}
                  </>
                )}
              </Notice>
            )}
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-ph-charcoal/25 px-6 py-8 text-center hover:border-ph-purple">
              <span className="font-semibold text-ph-charcoal">
                {fileName || 'Choose a CSV file'}
              </span>
              <span className="text-sm text-ph-charcoal/60">
                {rows.length > 0
                  ? `${num(body.length)} rows`
                  : 'Exported from Excel, Google Sheets or a CRM'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void load(f);
                  e.target.value = '';
                }}
              />
            </label>
            {parseError && <Notice tone="error">{parseError}</Notice>}

            {rows.length > 0 && (
              <>
                <label className="flex items-center gap-2 text-sm text-ph-charcoal/80">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={(e) => setHasHeader(e.target.checked)}
                  />
                  The first row is column names
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label htmlFor={`map-${f.key}`} className={labelClass}>
                        {f.label}
                      </label>
                      <select
                        id={`map-${f.key}`}
                        className={selectClass}
                        value={mapping[f.key]}
                        onChange={(e) =>
                          setMapping({
                            ...mapping,
                            [f.key]: Number(e.target.value),
                          })
                        }
                      >
                        <option value={-1}>
                          {f.key === 'email' ? 'Pick a column' : 'Not in the file'}
                        </option>
                        {columns.map((c, i) => (
                          <option key={i} value={i}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {mapping.email >= 0 && (
                  <div className="overflow-x-auto rounded-md border border-ph-charcoal/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-ph-charcoal/5 text-ph-charcoal/60">
                        <tr>
                          {FIELDS.map((f) => (
                            <th key={f.key} className="px-3 py-2 font-medium">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {body.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-t border-ph-charcoal/10">
                            {FIELDS.map((f) => (
                              <td key={f.key} className="px-3 py-2 text-ph-charcoal">
                                {mapping[f.key] >= 0 ? r[mapping[f.key]] : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {body.length > 5 && (
                      <p className="px-3 py-2 text-xs text-ph-charcoal/50">
                        and {num(body.length - 5)} more
                      </p>
                    )}
                  </div>
                )}

                <fieldset className="flex flex-col gap-2 text-sm text-ph-charcoal/80">
                  <legend className={labelClass}>What happens to people already on the list</legend>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === 'add'}
                      onChange={() => setMode('add')}
                      className="mt-1"
                    />
                    Keep them, and add anyone new
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === 'replace'}
                      onChange={() => setMode('replace')}
                      className="mt-1"
                    />
                    Replace the list with this file. Unsubscribes and bounces are always kept, so
                    they can't be re-added.
                  </label>
                </fieldset>

                {save.isError && <Notice tone="error">{save.error.message}</Notice>}
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => save.mutate()}
                    disabled={mapping.email < 0 || body.length === 0 || save.isPending}
                  >
                    {save.isPending ? 'Importing…' : `Import ${num(body.length)} rows`}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
