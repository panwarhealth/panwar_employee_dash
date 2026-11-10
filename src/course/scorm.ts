import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { Block, CourseDoc } from './doc';

export interface Answer {
  selected: string[];
  correct: boolean;
  firstCorrect: boolean;
}

export interface PlayState {
  v: 1;
  pageId: string;
  visited: string[];
  answers: Record<string, Answer>;
  picks?: Record<string, string[]>;
  clicked?: string[];
  skip?: string[];
  vars?: Record<string, string>;
  vis?: Record<string, boolean>;
  hub?: string;
}

export type Outcome = 'completed' | 'passed' | 'failed';

export interface Lms {
  load(): PlayState | null;
  save(state: PlayState): void;
  finish(status: Outcome, score: number | null): void;
}

interface Scorm12Api {
  LMSInitialize(arg: ''): string;
  LMSGetValue(el: string): string;
  LMSSetValue(el: string, value: string): string;
  LMSCommit(arg: ''): string;
  LMSFinish(arg: ''): string;
}

type Asked = Extract<
  Block,
  { type: 'check' | 'drag' | 'match' | 'blank' | 'slider' | 'written' | 'likert' }
>;

const ASKED = new Set(['check', 'drag', 'match', 'blank', 'slider', 'written', 'likert']);

const KIND: Record<Asked['type'], string> = {
  check: 'choice',
  drag: 'matching',
  match: 'matching',
  blank: 'fill-in',
  slider: 'numeric',
  written: 'fill-in',
  likert: 'likert',
};

function findApi(): Scorm12Api | null {
  let win: Window | null = window;
  for (let i = 0; win && i < 10; i++) {
    try {
      const api = (win as unknown as { API?: Scorm12Api }).API;
      if (api) return api;
    } catch {
      return null;
    }
    if (win.parent === win) break;
    win = win.parent;
  }
  try {
    return (window.opener as { API?: Scorm12Api } | null)?.API ?? null;
  } catch {
    return null;
  }
}

const PACKED = 'z:';

const pack = (state: PlayState) =>
  PACKED + btoa(strFromU8(deflateSync(strToU8(JSON.stringify(state)), { level: 9 }), true));

function parse(raw: string | null): PlayState | null {
  if (!raw) return null;
  try {
    const json = raw.startsWith(PACKED)
      ? strFromU8(inflateSync(strToU8(atob(raw.slice(PACKED.length)), true)))
      : raw;
    const s = JSON.parse(json) as PlayState;
    return s.v === 1 ? s : null;
  } catch {
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

const timespan = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const label = (list: { id: string; text?: string; label?: string }[], id: string) => {
  const hit = list.find((x) => x.id === id);
  return hit?.text ?? hit?.label ?? id;
};

const pieces = (text: string) => {
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += 255) out.push(chars.slice(i, i + 255).join(''));
  return out.length ? out : [''];
};

const split = (selected: string[]) => selected.map((s) => s.split('=') as [string, string]);

export function describeAnswer(b: Asked, selected: string[]): string {
  if (b.type === 'check') return selected.map((id) => label(b.options, id)).join('; ');
  if (b.type === 'drag')
    return split(selected)
      .map(
        ([item, zone]) =>
          `${label(b.items, item)} = ${
            b.style === 'order'
              ? Number(zone.slice(1)) + 1
              : label(b.style === 'targets' ? b.targets : b.groups, zone)
          }`,
      )
      .join('; ');
  if (b.type === 'match')
    return split(selected)
      .map(
        ([left, right]) =>
          `${b.pairs.find((p) => p.id === left)?.left ?? left} = ${
            b.pairs.find((p) => p.id === right)?.right ?? right
          }`,
      )
      .join('; ');
  if (b.type === 'likert')
    return split(selected)
      .map(([row, v]) => `${label(b.rows, row)} = ${b.scale[Number(v)] ?? v}`)
      .join('; ');
  return selected.join('; ');
}

export function scormLms(doc: CourseDoc): Lms | null {
  const api = findApi();
  if (!api) return null;
  api.LMSInitialize('');
  const started = Date.now();
  const set = (el: string, value: string) => api.LMSSetValue(el, value);
  if (api.LMSGetValue('cmi.core.lesson_status') === 'not attempted')
    set('cmi.core.lesson_status', 'incomplete');

  const asked = new Map<string, { block: Asked; pageId: string }>();
  for (const p of doc.pages)
    for (const b of p.blocks)
      if (ASKED.has(b.type)) asked.set(b.id, { block: b as Asked, pageId: p.id });
  const reported = new Map<string, string>();
  let count = Number(api.LMSGetValue('cmi.interactions._count')) || 0;
  let latest: PlayState | null = null;
  let finished = false;

  const report = (state: PlayState, all: boolean) => {
    if (!Object.keys(state.answers).length) reported.clear();
    for (const [id, a] of Object.entries(state.answers)) {
      const q = asked.get(id);
      const key = JSON.stringify(a.selected);
      if (!q || reported.get(id) === key || (!all && q.pageId === state.pageId)) continue;
      reported.set(id, key);
      const safe = id.replace(/[^A-Za-z0-9_.-]/g, '_');
      const type =
        q.block.type === 'drag' && q.block.style === 'order' ? 'sequencing' : KIND[q.block.type];
      const result =
        'scored' in q.block && q.block.scored ? (a.correct ? 'correct' : 'wrong') : 'neutral';
      const time = clock(new Date());
      const parts = pieces(describeAnswer(q.block, a.selected));
      parts.forEach((part, i) => {
        const n = `cmi.interactions.${count++}.`;
        set(`${n}id`, parts.length > 1 ? `${safe}-part-${i + 1}-of-${parts.length}` : safe);
        set(`${n}type`, type);
        set(`${n}time`, time);
        set(`${n}student_response`, part);
        set(`${n}result`, result);
      });
    }
  };

  const close = (exit: string) => {
    finished = true;
    set('cmi.core.exit', exit);
    set('cmi.core.session_time', timespan(Date.now() - started));
    api.LMSCommit('');
    api.LMSFinish('');
  };

  window.addEventListener('pagehide', () => {
    if (finished) return;
    if (latest) report(latest, true);
    close('suspend');
  });

  return {
    load: () => {
      const state = parse(api.LMSGetValue('cmi.suspend_data'));
      for (const [id, a] of Object.entries(state?.answers ?? {}))
        reported.set(id, JSON.stringify(a.selected));
      return state;
    },
    save: (state) => {
      if (finished) return;
      latest = state;
      report(state, false);
      set('cmi.suspend_data', pack(state));
      set('cmi.core.lesson_location', state.pageId);
      set('cmi.core.session_time', timespan(Date.now() - started));
      api.LMSCommit('');
    },
    finish: (status, score) => {
      if (finished) return;
      if (latest) report(latest, true);
      if (score !== null) {
        set('cmi.core.score.min', '0');
        set('cmi.core.score.max', '100');
        set('cmi.core.score.raw', String(score));
      }
      set('cmi.core.lesson_status', status);
      if (status === 'failed') {
        set('cmi.core.session_time', timespan(Date.now() - started));
        api.LMSCommit('');
      } else close('');
    },
  };
}

export function memoryLms(key: string | null): Lms {
  let stored: string | null = null;
  return {
    load: () => parse(key ? localStorage.getItem(key) : stored),
    save: (state) => {
      const raw = JSON.stringify(state);
      if (key) localStorage.setItem(key, raw);
      else stored = raw;
    },
    finish: () => {},
  };
}
