import type { CompareOp, Condition, CourseDoc, SetOp, TriggerEvent, Variable } from './doc';

export type Vars = Record<string, string>;

export const initialVars = (doc: CourseDoc): Vars =>
  Object.fromEntries(doc.variables.map((v) => [v.id, v.initial]));

const findVar = (doc: CourseDoc, id: string): Variable | undefined =>
  doc.variables.find((v) => v.id === id);

function compare(type: Variable['type'], a: string, op: CompareOp, b: string): boolean {
  if (type === 'number') {
    const x = Number(a) || 0;
    const y = Number(b) || 0;
    return { eq: x === y, ne: x !== y, lt: x < y, gt: x > y, lte: x <= y, gte: x >= y }[op];
  }
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return { eq: x === y, ne: x !== y, lt: x < y, gt: x > y, lte: x <= y, gte: x >= y }[op];
}

export function passes(conditions: Condition[], vars: Vars, doc: CourseDoc): boolean {
  let result = true;
  conditions.forEach((c, i) => {
    const v = findVar(doc, c.varId);
    const ok = v ? compare(v.type, vars[c.varId] ?? v.initial, c.op, c.value) : false;
    result = i === 0 ? ok : c.join === 'or' ? result || ok : result && ok;
  });
  return result;
}

export function applySet(
  vars: Vars,
  doc: CourseDoc,
  varId: string,
  op: SetOp,
  value: string,
): Vars {
  const v = findVar(doc, varId);
  if (!v) return vars;
  const current = vars[varId] ?? v.initial;
  let next = value;
  if (op === 'toggle') next = current === 'true' ? 'false' : 'true';
  else if (op === 'add') next = String((Number(current) || 0) + (Number(value) || 0));
  else if (op === 'subtract') next = String((Number(current) || 0) - (Number(value) || 0));
  return { ...vars, [varId]: next };
}

export const eventMatches = (a: TriggerEvent, b: TriggerEvent): boolean =>
  a.kind === b.kind &&
  (a.kind === 'pageStart' ||
    (a.kind === 'varChange' && b.kind === 'varChange' && a.varId === b.varId) ||
    ((a.kind === 'click' || a.kind === 'mediaEnd') &&
      (b.kind === 'click' || b.kind === 'mediaEnd') &&
      a.blockId === b.blockId));

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function mergeText(
  text: string,
  vars: Vars,
  doc: CourseDoc,
  extras: Record<string, string>,
  html: boolean,
): string {
  if (!text.includes('{')) return text;
  return text.replace(/\{([A-Za-z0-9_ .-]+)\}/g, (whole, raw: string) => {
    const name = raw.trim().toLowerCase();
    const v = doc.variables.find((x) => x.name.toLowerCase() === name);
    const value = v ? (vars[v.id] ?? v.initial) : extras[name];
    if (value === undefined) return whole;
    return html ? escapeHtml(value) : value;
  });
}
