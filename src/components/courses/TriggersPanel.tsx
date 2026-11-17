import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Trash2 } from 'lucide-react';
import { uid, type CourseDoc, type Page, type Trigger } from '@/course/doc';
import { objectOptions } from './blockMeta';
import { readFlag, saveFlag } from './flags';
import { TriggerWizard } from './TriggerWizard';
import { actionText, conditionText, eventText, triggerGroup } from './triggerText';

const OPEN_KEY = 'course-editor.triggers-open';

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
  const [open, setOpen] = useState(() => readFlag(OPEN_KEY));
  const groups = [
    { id: null as string | null, title: 'Page triggers' },
    ...objectOptions(page)
      .filter((o) => page.triggers.some((t) => triggerGroup(t) === o.value))
      .map((o) => ({ id: o.value as string | null, title: o.label.slice(0, 34) })),
  ].filter((g) => g.id !== null || page.triggers.some((t) => triggerGroup(t) === null));

  const swap = (a: Trigger, b: Trigger) =>
    onChange(page.triggers.map((x) => (x.id === a.id ? b : x.id === b.id ? a : x)));

  const save = (t: Trigger) => {
    const exists = page.triggers.some((x) => x.id === t.id);
    onChange(exists ? page.triggers.map((x) => (x.id === t.id ? t : x)) : [...page.triggers, t]);
    setEditing(null);
  };

  return (
    <div className="mt-4 border-t border-ph-charcoal/10 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            saveFlag(OPEN_KEY, !open);
          }}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ph-charcoal/50 hover:text-ph-purple"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Triggers{page.triggers.length > 0 && ` (${page.triggers.length})`}
        </button>
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
      {open && page.triggers.length === 0 && (
        <p className="text-xs text-ph-charcoal/50">
          No triggers on this page. Triggers make things happen: when this happens, do that.
        </p>
      )}
      {open &&
        groups.map((g) => {
          const list = page.triggers.filter((t) => triggerGroup(t) === g.id);
          const button = page.blocks.find((x) => x.id === g.id && x.type === 'button');
          return (
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
              {list.length > 1 && (
                <p className="text-[11px] text-ph-charcoal/50">
                  Run top to bottom. The first one that goes somewhere wins.
                </p>
              )}
              {list.map((t, i) => (
                <div
                  key={t.id}
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-white"
                >
                  {list.length > 1 && (
                    <span className="w-4 shrink-0 pt-0.5 text-xs font-semibold text-ph-charcoal/40">
                      {i + 1}.
                    </span>
                  )}
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
                  {list.length > 1 && (
                    <span className="invisible flex flex-col group-hover:visible">
                      <button
                        type="button"
                        title="Run earlier"
                        disabled={i === 0}
                        className="text-ph-charcoal/40 hover:text-ph-purple disabled:opacity-30"
                        onClick={() => swap(t, list[i - 1])}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Run later"
                        disabled={i === list.length - 1}
                        className="text-ph-charcoal/40 hover:text-ph-purple disabled:opacity-30"
                        onClick={() => swap(t, list[i + 1])}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
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
              {button?.type === 'button' && (
                <p className="px-2 text-xs text-ph-charcoal/60">
                  {list.length > 1 ? 'If none of these goes anywhere' : 'If that goes nowhere'},
                  the button does: {actionText(button.action, doc, page)}
                </p>
              )}
            </div>
          );
        })}
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
