import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { uid, type CourseDoc, type Page, type Trigger } from '@/course/doc';
import { blockLabel } from './blockMeta';
import { TriggerWizard } from './TriggerWizard';
import { actionText, conditionText, eventText, triggerGroup } from './triggerText';

export function TriggersPanel({
  doc,
  page,
  selectedId,
  onChange,
}: {
  doc: CourseDoc;
  page: Page;
  selectedId: string | null;
  onChange: (triggers: Trigger[]) => void;
}) {
  const [editing, setEditing] = useState<Trigger | null>(null);
  const groups = [
    { id: null as string | null, title: 'Page triggers' },
    ...page.blocks
      .filter((b) => page.triggers.some((t) => triggerGroup(t) === b.id))
      .map((b) => ({ id: b.id as string | null, title: blockLabel(b).slice(0, 34) })),
  ].filter((g) => g.id !== null || page.triggers.some((t) => triggerGroup(t) === null));

  const save = (t: Trigger) => {
    const exists = page.triggers.some((x) => x.id === t.id);
    onChange(exists ? page.triggers.map((x) => (x.id === t.id ? t : x)) : [...page.triggers, t]);
    setEditing(null);
  };

  return (
    <div className="mt-4 border-t border-ph-charcoal/10 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50">
          Triggers
        </h4>
        <button
          type="button"
          className="text-sm text-ph-purple underline underline-offset-4"
          onClick={() =>
            setEditing({
              id: uid(),
              action: { kind: 'next' },
              when: selectedId ? { kind: 'click', blockId: selectedId } : { kind: 'pageStart' },
              conditions: [],
            })
          }
        >
          + New trigger
        </button>
      </div>
      {page.triggers.length === 0 && (
        <p className="text-xs text-ph-charcoal/50">
          No triggers on this page. Triggers make things happen: when this happens, do that.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.id ?? 'page'} className="mb-2">
          <p
            className={
              g.id && g.id === selectedId
                ? 'text-xs font-bold text-ph-purple'
                : 'text-xs font-bold text-ph-charcoal/70'
            }
          >
            {g.title}
          </p>
          {page.triggers
            .filter((t) => triggerGroup(t) === g.id)
            .map((t) => (
              <div
                key={t.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-white"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditing(t)}
                >
                  <span className="block text-sm text-ph-purple">
                    {actionText(t.action, doc, page)}
                  </span>
                  <span className="block pl-3 text-xs text-ph-charcoal/70">
                    {eventText(t.when, doc, page)}
                  </span>
                  {t.conditions.length > 0 && (
                    <span className="block pl-3 text-xs text-ph-charcoal/60">
                      {conditionText(t.conditions, doc)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  title="Delete trigger"
                  className="invisible text-ph-charcoal/40 hover:text-red-600 group-hover:visible"
                  onClick={() => onChange(page.triggers.filter((x) => x.id !== t.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
        </div>
      ))}
      {editing && (
        <TriggerWizard
          doc={doc}
          page={page}
          initial={editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
