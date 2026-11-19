import { hubsOf, type CourseDoc, type Page, type Trigger } from '@/course/doc';
import { objectLabel } from './blockMeta';
import { conditionText, triggerGroup } from './triggerText';

export interface FlowExit {
  id: string;
  from: string;
  to: string | null;
  step: 'page' | 'next' | 'prev' | 'finish';
  start: string;
  condition: string;
  rank: number | null;
  detour: boolean;
  triggerId?: string;
  buttonId?: string;
  choice?: { blockId: string; choiceId: string };
  bar?: boolean;
}

export type Spot = { x: number; y: number };

export const CARD = { width: 288, head: 20, first: 71, row: 22, shown: 8 };

export type WireKind = 'next' | 'jump' | 'if' | 'side' | 'again' | 'back';

export interface Wire {
  id: string;
  from: string;
  to: string;
  row: number;
  kind: WireKind;
}

export const WIRE_LOOK: Record<
  WireKind,
  { colour: string; width: number; dash: number[]; name: string }
> = {
  next: { colour: '#8b8f96', width: 2.5, dash: [], name: 'Next page' },
  jump: { colour: '#702f8f', width: 2, dash: [], name: 'Jump to a page' },
  if: { colour: '#d97706', width: 2, dash: [], name: 'Jump with a condition' },
  side: { colour: '#0d9488', width: 2, dash: [7, 5], name: 'Side page that comes back' },
  again: { colour: '#0d9488', width: 2, dash: [7, 5], name: 'Side page that comes back' },
  back: { colour: '#b3acba', width: 1.5, dash: [3, 5], name: 'Return link' },
};

export type Curve = [number, number, number, number, number, number, number, number];

const LEAVES = new Set(['next', 'prev', 'page', 'finish']);

const startKey = (t: Trigger) =>
  `${t.when.kind}:${triggerGroup(t) ?? (t.when.kind === 'varChange' ? t.when.varId : '')}`;

export function sameStart(page: Page, triggerId: string): Trigger[] {
  const t = page.triggers.find((x) => x.id === triggerId);
  if (!t) return [];
  const key = startKey(t);
  return page.triggers.filter((x) => LEAVES.has(x.action.kind) && startKey(x) === key);
}

const short = (s: string) => (s.length > 24 ? `${s.slice(0, 22)}…` : s);

function startText(page: Page, kind: string, id: string | null, varName: string): string {
  if (kind === 'pageStart') return 'Page opens';
  if (kind === 'varChange') return `${varName} changes`;
  const name = (id && objectLabel(page, id)?.replace(/^Group: /, '')) || 'deleted object';
  return kind === 'mediaEnd' ? `${short(name)} ends` : `Click ${short(name)}`;
}

export function flowExits(doc: CourseDoc): FlowExit[] {
  const out: FlowExit[] = [];
  const ids = new Set(doc.pages.map((p) => p.id));
  const hubOf = hubsOf(doc);
  const main = (p: Page) => !hubOf.has(p.id);
  doc.pages.forEach((page, i) => {
    const hub = hubOf.get(page.id);
    const target = (step: FlowExit['step'], pageId?: string): string | null => {
      if (step === 'page') return pageId && ids.has(pageId) ? pageId : null;
      if (step === 'finish') return null;
      if (hub && hub !== page.id) return hub;
      const pool = step === 'next' ? doc.pages.slice(i + 1) : doc.pages.slice(0, i).reverse();
      return pool.find(main)?.id ?? null;
    };
    const gone = new Set(page.blocks.filter((b) => b.hidden).map((b) => b.id));
    const exits: (FlowExit & { key: string })[] = [];
    for (const t of page.triggers) {
      if (!LEAVES.has(t.action.kind)) continue;
      const from = triggerGroup(t);
      if (from && gone.has(from)) continue;
      const step = t.action.kind as FlowExit['step'];
      const varId = t.when.kind === 'varChange' ? t.when.varId : '';
      const varName = doc.variables.find((v) => v.id === varId)?.name ?? 'a variable';
      exits.push({
        key: startKey(t),
        id: `trigger:${t.id}`,
        from: page.id,
        to: target(step, t.action.kind === 'page' ? t.action.pageId : undefined),
        step,
        start: startText(page, t.when.kind, from, varName),
        condition: conditionText(t.conditions, doc),
        rank: null,
        detour: t.action.kind === 'page' && !!t.action.back,
        triggerId: t.id,
      });
    }
    for (const b of page.blocks) {
      if (b.hidden) continue;
      if (b.type === 'button' && (b.action.kind === 'next' || b.action.kind === 'page'))
        exits.push({
          key: `click:${b.id}`,
          id: `button:${b.id}`,
          from: page.id,
          to: target(b.action.kind, b.action.kind === 'page' ? b.action.pageId : undefined),
          step: b.action.kind,
          start: startText(page, 'click', b.id, ''),
          condition: '',
          rank: null,
          detour: b.action.kind === 'page' && !!b.action.back,
          buttonId: b.id,
        });
      if (b.type === 'pathway')
        for (const c of b.choices) {
          if (!c.pageId) continue;
          exits.push({
            key: `choice:${c.id}`,
            id: `choice:${b.id}:${c.id}`,
            from: page.id,
            to: target('page', c.pageId),
            step: 'page',
            start: `Choose ${short(c.label || 'a choice')}`,
            condition: '',
            rank: null,
            detour: false,
            choice: { blockId: b.id, choiceId: c.id },
          });
        }
    }
    if (doc.navBar)
      exits.push({
        key: 'bar',
        id: `bar:${page.id}`,
        from: page.id,
        to: target('next'),
        step: 'next',
        start: 'Click Continue',
        condition: '',
        rank: null,
        detour: false,
        bar: true,
      });
    const counts = new Map<string, number>();
    for (const e of exits) counts.set(e.key, (counts.get(e.key) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const { key, ...e } of exits) {
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      out.push({ ...e, rank: (counts.get(key) ?? 0) > 1 ? n : null });
    }
  });
  return out;
}

export function flowWires(doc: CourseDoc, exits: FlowExit[]): Wire[] {
  const hubOf = hubsOf(doc);
  const rows = new Map<string, number>();
  return exits.flatMap((e) => {
    const row = rows.get(e.from) ?? 0;
    rows.set(e.from, row + 1);
    if (!e.to || e.to === e.from) return [];
    const kind: WireKind =
      e.step === 'prev' || hubOf.get(e.from) === e.to
        ? 'back'
        : e.detour
          ? hubOf.get(e.to) === e.from
            ? 'side'
            : 'again'
          : e.condition
            ? 'if'
            : e.step === 'next'
              ? 'next'
              : 'jump';
    return [{ id: e.id, from: e.from, to: e.to, row: Math.min(row, CARD.shown), kind }];
  });
}

export function curve(from: Spot, row: number, to: Spot): Curve {
  const sx = from.x + CARD.width;
  const sy = from.y + CARD.first + row * CARD.row;
  const tx = to.x;
  const ty = to.y + CARD.head;
  const reach = Math.min(400, Math.max(60, Math.abs(tx - sx) / 2));
  return [sx, sy, sx + reach, sy, tx - reach, ty, tx, ty];
}

export function pointOn(c: Curve, t: number): Spot {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return { x: a * c[0] + b * c[2] + d * c[4] + e * c[6], y: a * c[1] + b * c[3] + d * c[5] + e * c[7] };
}

const STEPS = 32;

export function wireAt(curves: Map<string, Curve>, x: number, y: number, reach: number): string | null {
  let best: string | null = null;
  let near = reach * reach;
  for (const [id, c] of curves) {
    if (
      x < Math.min(c[0], c[2], c[4], c[6]) - reach ||
      x > Math.max(c[0], c[2], c[4], c[6]) + reach ||
      y < Math.min(c[1], c[7]) - reach ||
      y > Math.max(c[1], c[7]) + reach
    )
      continue;
    let p = pointOn(c, 0);
    for (let i = 1; i <= STEPS; i++) {
      const q = pointOn(c, i / STEPS);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const along = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1)));
      const gap = (p.x + along * dx - x) ** 2 + (p.y + along * dy - y) ** 2;
      if (gap <= near) {
        near = gap;
        best = id;
      }
      p = q;
    }
  }
  return best;
}

const COLUMNS = 8;
const COLUMN = 380;
const ROW = 280;
const BAND_GAP = 120;

function autoPositions(doc: CourseDoc, exits: FlowExit[]): Map<string, Spot> {
  const out = new Map<string, Spot>();
  const first = doc.pages[0]?.id;
  if (!first) return out;
  const weight = (e: FlowExit) => (e.step === 'next' ? 0 : e.detour ? 2 : 1);
  const onward = new Map<string, string[]>();
  for (const e of [...exits].sort((a, b) => weight(a) - weight(b))) {
    if (!e.to || e.step === 'prev') continue;
    onward.set(e.from, [...(onward.get(e.from) ?? []), e.to]);
  }
  const column = new Map([[first, 0]]);
  const kids = new Map<string, string[]>();
  const queue = [first];
  while (queue.length) {
    const id = queue.shift()!;
    for (const to of onward.get(id) ?? [])
      if (!column.has(to)) {
        column.set(to, column.get(id)! + 1);
        kids.set(id, [...(kids.get(id) ?? []), to]);
        queue.push(to);
      }
  }
  const free: number[] = [];
  const rows = new Map<string, number>();
  const place = (id: string, least: number): number => {
    const at = column.get(id)!;
    const [lead, ...rest] = kids.get(id) ?? [];
    let row = Math.max(least, free[at] ?? 0);
    if (lead) row = Math.max(row, place(lead, row));
    free[at] = row + 1;
    rows.set(id, row);
    for (const k of rest) place(k, row);
    return row;
  };
  place(first, 0);
  const below = Math.max(...free) * ROW + BAND_GAP;
  let loose = 0;
  for (const p of doc.pages) {
    const row = rows.get(p.id);
    out.set(
      p.id,
      row === undefined
        ? { x: loose++ * COLUMN, y: below }
        : { x: column.get(p.id)! * COLUMN, y: row * ROW },
    );
  }
  return out;
}

export function positions(doc: CourseDoc, exits: FlowExit[]): Map<string, Spot> {
  const pinned = doc.pages.filter((p) => p.flow);
  if (!pinned.length) return autoPositions(doc, exits);
  const below = Math.max(...pinned.map((p) => p.flow!.y)) + ROW + BAND_GAP;
  const out = new Map<string, Spot>();
  let loose = 0;
  for (const p of doc.pages) {
    if (p.flow) out.set(p.id, p.flow);
    else {
      out.set(p.id, { x: (loose % COLUMNS) * COLUMN, y: below + ROW * Math.floor(loose / COLUMNS) });
      loose++;
    }
  }
  return out;
}
