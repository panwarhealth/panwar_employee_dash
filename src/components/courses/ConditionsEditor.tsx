import { uid, type CompareOp, type Condition, type CourseDoc } from '@/course/doc';
import { COMPARE_OPS } from './triggerText';

const cell =
  'min-w-0 rounded-md border-[1.5px] border-ph-charcoal/15 bg-white px-2 py-1.5 text-sm focus:border-ph-purple focus:outline-none';

export function ConditionsEditor({
  doc,
  conditions,
  onChange,
}: {
  doc: CourseDoc;
  conditions: Condition[];
  onChange: (c: Condition[]) => void;
}) {
  const set = (i: number, patch: Partial<Condition>) =>
    onChange(conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  if (!doc.variables.length)
    return (
      <p className="text-xs text-ph-charcoal/60">
        Conditions check variables. Add one in the Variables window first.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      {conditions.map((c, i) => {
        const v = doc.variables.find((x) => x.id === c.varId);
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-1.5">
            {i === 0 ? (
              <span className="w-12 text-sm font-semibold text-ph-charcoal/60">if</span>
            ) : (
              <select
                className={`${cell} w-12`}
                value={c.join}
                onChange={(e) => set(i, { join: e.target.value as Condition['join'] })}
              >
                <option value="and">and</option>
                <option value="or">or</option>
              </select>
            )}
            <select
              className={`${cell} flex-1`}
              value={c.varId}
              onChange={(e) => set(i, { varId: e.target.value })}
            >
              {doc.variables.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <select
              className={`${cell} w-24`}
              value={c.op}
              onChange={(e) => set(i, { op: e.target.value as CompareOp })}
            >
              {(v?.type === 'boolean' ? COMPARE_OPS.slice(0, 2) : COMPARE_OPS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {v?.type === 'boolean' ? (
              <select
                className={`${cell} w-20`}
                value={c.value}
                onChange={(e) => set(i, { value: e.target.value })}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                className={`${cell} w-24`}
                type={v?.type === 'number' ? 'number' : 'text'}
                value={c.value}
                onChange={(e) => set(i, { value: e.target.value })}
              />
            )}
            <button
              type="button"
              title="Remove condition"
              className="px-1 text-ph-charcoal/40 hover:text-red-600"
              onClick={() => onChange(conditions.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="self-start text-sm text-ph-charcoal/60 underline underline-offset-4 hover:text-ph-purple"
        onClick={() => {
          const first = doc.variables[0];
          onChange([
            ...conditions,
            {
              id: uid(),
              join: 'and',
              varId: first.id,
              op: 'eq',
              value: first.type === 'boolean' ? 'true' : first.initial,
            },
          ]);
        }}
      >
        + if
      </button>
    </div>
  );
}
