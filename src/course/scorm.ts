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
}

export interface Lms {
  load(): PlayState | null;
  save(state: PlayState, progress: number): void;
  finish(status: 'completed' | 'passed' | 'failed', score: number | null): void;
}

interface Scorm12Api {
  LMSInitialize(arg: ''): string;
  LMSGetValue(el: string): string;
  LMSSetValue(el: string, value: string): string;
  LMSCommit(arg: ''): string;
  LMSFinish(arg: ''): string;
}

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

function parse(raw: string | null): PlayState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as PlayState;
    return s.v === 1 ? s : null;
  } catch {
    return null;
  }
}

export function scormLms(): Lms | null {
  const api = findApi();
  if (!api) return null;
  api.LMSInitialize('');
  let finished = false;
  return {
    load: () => parse(api.LMSGetValue('cmi.suspend_data')),
    save: (state, progress) => {
      if (finished) return;
      api.LMSSetValue('cmi.suspend_data', JSON.stringify(state));
      api.LMSSetValue('cmi.core.lesson_location', state.pageId);
      api.LMSSetValue('cmi.progress_measure', String(progress));
      api.LMSCommit('');
    },
    finish: (status, score) => {
      if (finished) return;
      finished = true;
      if (score !== null) {
        api.LMSSetValue('cmi.core.score.min', '0');
        api.LMSSetValue('cmi.core.score.max', '100');
        api.LMSSetValue('cmi.core.score.raw', String(score));
      }
      api.LMSSetValue('cmi.progress_measure', '1');
      api.LMSSetValue('cmi.core.lesson_status', status);
      api.LMSCommit('');
      api.LMSFinish('');
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
