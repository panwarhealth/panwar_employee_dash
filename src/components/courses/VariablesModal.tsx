import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { uid, type CourseDoc, type Variable, type VarType } from '@/course/doc';
import { variableUses } from './triggerText';

const TYPES: { value: VarType; label: string }[] = [
  { value: 'boolean', label: 'True/False' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
];

const DEFAULTS: Record<VarType, string> = { boolean: 'false', number: '0', text: '' };

const cell =
  'w-full rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2 py-1.5 text-sm focus:border-ph-purple focus:outline-none';

export function VariablesModal({
  open,
  onClose,
  doc,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  doc: CourseDoc;
  onChange: (fn: (d: CourseDoc) => void) => void;
}) {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const rows = doc.variables.filter((v) => !needle || v.name.toLowerCase().includes(needle));
  const edit = (id: string, fn: (v: Variable) => void) =>
    onChange((d) => fn(d.variables.find((v) => v.id === id)!));

  return (
    <Modal open={open} onClose={onClose} title="Variables" className="max-w-3xl">
      <div className="px-6 py-5">
        <div className="mb-4 flex items-center gap-3">
          <input
            className={`${cell} max-w-xs`}
            placeholder="Search variables"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="rounded-md bg-ph-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-ph-purple/90"
            onClick={() =>
              onChange((d) =>
                d.variables.push({
                  id: uid(),
                  name: `Variable${d.variables.length + 1}`,
                  type: 'boolean',
                  initial: 'false',
                }),
              )
            }
          >
            + New variable
          </button>
        </div>
        <p className="mb-3 text-xs text-ph-charcoal/60">
          Put a variable in any text with curly brackets, like {'{Name}'}. {'{Score}'} shows the
          learner's score.
        </p>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ph-charcoal/60">
            {doc.variables.length ? 'Nothing matches that search.' : 'No variables yet.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-ph-charcoal/60">
                <th className="pb-2 pr-2">Name</th>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Default value</th>
                <th className="pb-2 pr-2">Use count</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const uses = variableUses(doc, v.id);
                return (
                  <tr key={v.id} className="border-t border-ph-charcoal/10">
                    <td className="py-2 pr-2">
                      <input
                        className={cell}
                        value={v.name}
                        onChange={(e) =>
                          edit(v.id, (x) => (x.name = e.target.value.replace(/[{}]/g, '')))
                        }
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className={cell}
                        value={v.type}
                        onChange={(e) =>
                          edit(v.id, (x) => {
                            x.type = e.target.value as VarType;
                            x.initial = DEFAULTS[x.type];
                          })
                        }
                      >
                        {TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      {v.type === 'boolean' ? (
                        <select
                          className={cell}
                          value={v.initial}
                          onChange={(e) => edit(v.id, (x) => (x.initial = e.target.value))}
                        >
                          <option value="false">False</option>
                          <option value="true">True</option>
                        </select>
                      ) : (
                        <input
                          className={cell}
                          type={v.type === 'number' ? 'number' : 'text'}
                          value={v.initial}
                          onChange={(e) => edit(v.id, (x) => (x.initial = e.target.value))}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 text-center text-ph-charcoal/70">{uses}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={uses > 0}
                        title={
                          uses > 0 ? 'Remove the triggers and conditions using it first' : 'Delete'
                        }
                        className="text-sm text-red-700 underline underline-offset-4 disabled:text-ph-charcoal/30 disabled:no-underline"
                        onClick={() =>
                          onChange((d) => (d.variables = d.variables.filter((x) => x.id !== v.id)))
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
