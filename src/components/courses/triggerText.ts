import type {
  Action,
  CompareOp,
  Condition,
  CourseDoc,
  Page,
  SetOp,
  Trigger,
  TriggerEvent,
} from '@/course/doc';
import { blockLabel } from './blockMeta';

export const ACTIONS: { value: Action['kind']; label: string }[] = [
  { value: 'next', label: 'Go to next page' },
  { value: 'prev', label: 'Go to previous page' },
  { value: 'page', label: 'Jump to page' },
  { value: 'set', label: 'Adjust variable' },
  { value: 'show', label: 'Show object' },
  { value: 'hide', label: 'Hide object' },
  { value: 'popup', label: 'Open pop-up layer' },
  { value: 'closePopup', label: 'Close pop-up layer' },
  { value: 'pick', label: 'Mark as a pick' },
  { value: 'link', label: 'Open a link' },
  { value: 'finish', label: 'Finish the course' },
];

export const EVENTS: { value: TriggerEvent['kind']; label: string }[] = [
  { value: 'click', label: 'User clicks' },
  { value: 'pageStart', label: 'Page starts' },
  { value: 'varChange', label: 'Variable changes' },
  { value: 'mediaEnd', label: 'Media completes' },
];

export const SET_OPS: { value: SetOp; label: string }[] = [
  { value: 'set', label: '= Assignment' },
  { value: 'add', label: '+ Add' },
  { value: 'subtract', label: '- Subtract' },
  { value: 'toggle', label: 'Not Assignment (toggle true/false)' },
];

export const COMPARE_OPS: { value: CompareOp; label: string }[] = [
  { value: 'eq', label: '== Equal to' },
  { value: 'ne', label: '!= Not equal to' },
  { value: 'lt', label: '< Less than' },
  { value: 'gt', label: '> Greater than' },
  { value: 'lte', label: '<= Less than or equal to' },
  { value: 'gte', label: '>= Greater than or equal to' },
];

const opSymbol: Record<CompareOp, string> = {
  eq: '==',
  ne: '!=',
  lt: '<',
  gt: '>',
  lte: '<=',
  gte: '>=',
};

const varName = (doc: CourseDoc, id: string) =>
  doc.variables.find((v) => v.id === id)?.name ?? 'missing variable';

const objectName = (page: Page, id: string) => {
  const b = page.blocks.find((x) => x.id === id);
  return b ? blockLabel(b).slice(0, 30) : 'missing object';
};

export function actionText(a: Action, doc: CourseDoc, page: Page): string {
  switch (a.kind) {
    case 'next':
      return 'Go to next page';
    case 'prev':
      return 'Go to previous page';
    case 'page':
      return `Jump to ${doc.pages.find((p) => p.id === a.pageId)?.title ?? 'missing page'}`;
    case 'set':
      return a.op === 'toggle'
        ? `Toggle ${varName(doc, a.varId)}`
        : `Adjust ${varName(doc, a.varId)} ${{ set: '=', add: '+', subtract: '-' }[a.op]} ${a.value}`;
    case 'show':
      return `Show ${objectName(page, a.blockId)}`;
    case 'hide':
      return `Hide ${objectName(page, a.blockId)}`;
    case 'popup':
      return `Open pop-up ${objectName(page, a.blockId)}`;
    case 'closePopup':
      return 'Close pop-up layer';
    case 'pick':
      return 'Mark as a pick';
    case 'link':
      return `Open ${a.url || 'a link'}`;
    case 'finish':
      return 'Finish the course';
  }
}

export function eventText(e: TriggerEvent, doc: CourseDoc, page: Page): string {
  switch (e.kind) {
    case 'click':
      return `When the user clicks ${objectName(page, e.blockId)}`;
    case 'pageStart':
      return 'When the page starts';
    case 'varChange':
      return `When ${varName(doc, e.varId)} changes`;
    case 'mediaEnd':
      return `When ${objectName(page, e.blockId)} completes`;
  }
}

export const conditionText = (conditions: Condition[], doc: CourseDoc): string =>
  conditions
    .map(
      (c, i) => `${i ? `${c.join} ` : 'if '}${varName(doc, c.varId)} ${opSymbol[c.op]} ${c.value}`,
    )
    .join(' ');

export const triggerGroup = (t: Trigger): string | null =>
  t.when.kind === 'click' || t.when.kind === 'mediaEnd' ? t.when.blockId : null;

export function variableUses(doc: CourseDoc, varId: string): number {
  const json = JSON.stringify(doc.pages);
  return json.split(`"${varId}"`).length - 1;
}
