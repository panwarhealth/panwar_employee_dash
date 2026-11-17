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

type Spot = { x: number; y: number };

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
  if (kind === 'pageStart') return 'Page starts';
  if (kind === 'varChange') return `${varName} changes`;
  const name = (id && objectLabel(page, id)?.replace(/^Group: /, '')) || 'missing object';
  return kind === 'mediaEnd' ? `${short(name)} ends` : short(name);
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
            start: short(c.label || 'Choice'),
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
        start: 'Continue bar',
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

const COLUMNS = 8;
const COLUMN = 340;
const ROW = 230;
const BAND_GAP = 120;

function autoPositions(doc: CourseDoc, exits: FlowExit[]): Map<string, Spot> {
  const depth = new Map<string, number>();
  const first = doc.pages[0]?.id;
  if (first) depth.set(first, 0);
  const queue = first ? [first] : [];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of exits)
      if (e.from === id && e.to && !depth.has(e.to)) {
        depth.set(e.to, depth.get(id)! + 1);
        queue.push(e.to);
      }
  }
  const last = Math.max(0, ...depth.values()) + 1;
  const rows = new Map<number, number>();
  const placed: [string, number, number][] = [];
  for (const p of doc.pages) {
    const d = depth.get(p.id) ?? last;
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    placed.push([p.id, d, row]);
  }
  const bands = new Map<number, number>();
  for (const [d, n] of rows) {
    const band = Math.floor(d / COLUMNS);
    bands.set(band, Math.max(bands.get(band) ?? 0, n));
  }
  const top = new Map<number, number>();
  let y = 0;
  for (let band = 0; band <= Math.floor(last / COLUMNS); band++) {
    top.set(band, y);
    y += (bands.get(band) ?? 0) * ROW + BAND_GAP;
  }
  const out = new Map<string, Spot>();
  for (const [id, d, row] of placed)
    out.set(id, { x: (d % COLUMNS) * COLUMN, y: top.get(Math.floor(d / COLUMNS))! + row * ROW });
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
