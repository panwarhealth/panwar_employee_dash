import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { Action, CourseDoc, Page, SetOp, Trigger, TriggerEvent } from '@/course/doc';
import { blockLabel } from './blockMeta';
import { ConditionsEditor } from './ConditionsEditor';
import { Select, TextInput } from './fields';
import { ACTIONS, EVENTS, SET_OPS } from './triggerText';

function defaultAction(kind: Action['kind'], doc: CourseDoc, page: Page): Action {
  const firstBlock = page.blocks[0]?.id ?? '';
  const firstVar = doc.variables[0];
  switch (kind) {
    case 'page':
      return { kind, pageId: doc.pages[0].id };
    case 'link':
      return { kind, url: '' };
    case 'set':
      return {
        kind,
        varId: firstVar?.id ?? '',
        op: 'set',
        value: firstVar?.type === 'boolean' ? 'true' : '',
      };
    case 'show':
    case 'hide':
      return { kind, blockId: firstBlock };
    case 'popup':
      return { kind, blockId: page.blocks.find((b) => b.type === 'popup')?.id ?? '' };
    default:
      return { kind } as Action;
  }
}

function defaultEvent(
  kind: TriggerEvent['kind'],
  doc: CourseDoc,
  page: Page,
  objectId: string | null,
): TriggerEvent {
  switch (kind) {
    case 'click':
      return { kind, blockId: objectId ?? page.blocks[0]?.id ?? '' };
    case 'mediaEnd':
      return {
        kind,
        blockId: page.blocks.find((b) => b.type === 'audio' || b.type === 'video')?.id ?? '',
      };
    case 'varChange':
      return { kind, varId: doc.variables[0]?.id ?? '' };
    case 'pageStart':
      return { kind };
  }
}

export function TriggerWizard({
  doc,
  page,
  initial,
  onSave,
  onClose,
}: {
  doc: CourseDoc;
  page: Page;
  initial: Trigger;
  onSave: (t: Trigger) => void;
  onClose: () => void;
}) {
  const [t, setT] = useState(initial);
  const objects = page.blocks.map((b) => ({ value: b.id, label: blockLabel(b).slice(0, 40) }));
  const vars = doc.variables.map((v) => ({ value: v.id, label: v.name }));
  const popups = page.blocks
    .filter((b) => b.type === 'popup')
    .map((b) => ({ value: b.id, label: blockLabel(b) }));
  const media = page.blocks
    .filter((b) => b.type === 'audio' || b.type === 'video')
    .map((b) => ({ value: b.id, label: blockLabel(b) }));
  const a = t.action;
  const w = t.when;
  const setVar = a.kind === 'set' ? doc.variables.find((v) => v.id === a.varId) : undefined;
  const needsVar = (a.kind === 'set' || w.kind === 'varChange') && !vars.length;

  return (
    <Modal open onClose={onClose} title="Trigger Wizard" className="max-w-xl">
      <div className="flex flex-col gap-4 px-6 py-5">
        <section className="grid grid-cols-[90px_1fr] gap-3 rounded-md border border-ph-charcoal/10 p-3">
          <span className="pt-6 text-sm font-semibold text-ph-charcoal/70">Action</span>
          <div className="flex flex-col gap-2">
            <Select
              label="Action"
              value={a.kind}
              options={ACTIONS}
              onChange={(k) => setT({ ...t, action: defaultAction(k, doc, page) })}
            />
            {a.kind === 'page' && (
              <Select
                label="Page"
                value={a.pageId}
                options={doc.pages.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.title}` }))}
                onChange={(pageId) => setT({ ...t, action: { ...a, pageId } })}
              />
            )}
            {a.kind === 'link' && (
              <TextInput
                label="Link"
                placeholder="https://"
                value={a.url}
                onChange={(url) => setT({ ...t, action: { ...a, url } })}
              />
            )}
            {(a.kind === 'show' || a.kind === 'hide') && (
              <Select
                label="Object"
                value={a.blockId}
                options={objects}
                onChange={(blockId) => setT({ ...t, action: { ...a, blockId } })}
              />
            )}
            {a.kind === 'popup' &&
              (popups.length ? (
                <Select
                  label="Pop-up"
                  value={a.blockId}
                  options={popups}
                  onChange={(blockId) => setT({ ...t, action: { ...a, blockId } })}
                />
              ) : (
                <p className="text-xs text-ph-charcoal/60">
                  Add a Pop-up block to this page first.
                </p>
              ))}
            {a.kind === 'set' && vars.length > 0 && (
              <>
                <Select
                  label="Variable"
                  value={a.varId}
                  options={vars}
                  onChange={(varId) => setT({ ...t, action: { ...a, varId } })}
                />
                <Select
                  label="Operator"
                  value={a.op}
                  options={
                    setVar?.type === 'number'
                      ? SET_OPS.slice(0, 3)
                      : setVar?.type === 'boolean'
                        ? [SET_OPS[0], SET_OPS[3]]
                        : [SET_OPS[0]]
                  }
                  onChange={(op: SetOp) => setT({ ...t, action: { ...a, op } })}
                />
                {a.op !== 'toggle' &&
                  (setVar?.type === 'boolean' ? (
                    <Select
                      label="Value"
                      value={a.value === 'true' ? 'true' : 'false'}
                      options={[
                        { value: 'true', label: 'True' },
                        { value: 'false', label: 'False' },
                      ]}
                      onChange={(value) => setT({ ...t, action: { ...a, value } })}
                    />
                  ) : (
                    <TextInput
                      label="Value"
                      value={a.value}
                      onChange={(value) => setT({ ...t, action: { ...a, value } })}
                    />
                  ))}
              </>
            )}
          </div>
        </section>

        <section className="grid grid-cols-[90px_1fr] gap-3 rounded-md border border-ph-charcoal/10 p-3">
          <span className="pt-6 text-sm font-semibold text-ph-charcoal/70">When</span>
          <div className="flex flex-col gap-2">
            <Select
              label="When"
              value={w.kind}
              options={EVENTS}
              onChange={(k) =>
                setT({
                  ...t,
                  when: defaultEvent(k, doc, page, w.kind === 'click' ? w.blockId : null),
                })
              }
            />
            {w.kind === 'click' && (
              <Select
                label="Object"
                value={w.blockId}
                options={objects}
                onChange={(blockId) => setT({ ...t, when: { ...w, blockId } })}
              />
            )}
            {w.kind === 'mediaEnd' &&
              (media.length ? (
                <Select
                  label="Media"
                  value={w.blockId}
                  options={media}
                  onChange={(blockId) => setT({ ...t, when: { ...w, blockId } })}
                />
              ) : (
                <p className="text-xs text-ph-charcoal/60">Add an audio or video block first.</p>
              ))}
            {w.kind === 'varChange' && vars.length > 0 && (
              <Select
                label="Variable"
                value={w.varId}
                options={vars}
                onChange={(varId) => setT({ ...t, when: { ...w, varId } })}
              />
            )}
          </div>
        </section>

        <section className="grid grid-cols-[90px_1fr] gap-3 rounded-md border border-ph-charcoal/10 p-3">
          <span className="text-sm font-semibold text-ph-charcoal/70">
            Conditions
            <span className="block text-xs font-normal text-ph-charcoal/50">(optional)</span>
          </span>
          <ConditionsEditor
            doc={doc}
            conditions={t.conditions}
            onChange={(conditions) => setT({ ...t, conditions })}
          />
        </section>

        {needsVar && (
          <p className="text-sm text-red-700">
            This needs a variable. Add one in the Variables window first.
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button disabled={needsVar} onClick={() => onSave(t)}>
            OK
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
