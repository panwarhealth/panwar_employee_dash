import { useEffect, useMemo, useRef, useState } from 'react';
import {
  newPickRule,
  type Block,
  type Action,
  type CourseDoc,
  type Layout,
  type Page,
  type PopupBlock,
  type TriggerEvent,
} from './doc';
import type { Lms, PlayState } from './scorm';
import type { BlockContext } from './context';
import { accentStyle } from './util';
import { CanvasStage } from './canvas';
import { useCanvasLayout } from './canvasLayout';
import { pickBlocks, pickStatus, togglePick } from './picks';
import { choosePool, computeResults, cueHidden, resultsSettings } from './grading';
import { PopupLayer } from './interactive';
import { fontFaces, textStyleCss } from './typography';
import { hasExit, OUT_MS } from './anim';
import { applySet, eventMatches, initialVars, mergeText, passes, type Vars } from './logic';

function PickFeedback({
  page,
  correct,
  ctx,
  onRetry,
}: {
  page: Page;
  correct: boolean;
  ctx: BlockContext;
  onRetry: () => void;
}) {
  const rule = page.pick ?? newPickRule();
  return (
    <div className={`cp-pickfb cp-pickfb-${rule.showAs}`}>
      <div className={`cp-fb ${correct ? 'cp-fb-ok' : 'cp-fb-bad'}`}>
        <p>{correct ? rule.feedbackCorrect : rule.feedbackWrong}</p>
        <button
          type="button"
          className={`cp-btn ${correct ? 'cp-btn-solid' : 'cp-btn-outline'}`}
          onClick={correct ? ctx.next : onRetry}
        >
          {correct ? 'Continue' : 'Try again'}
        </button>
      </div>
    </div>
  );
}

function PageBody({
  page,
  layout,
  ctx,
  hidden,
  leaving,
  onRetryPicks,
}: {
  page: Page;
  layout: Layout;
  ctx: BlockContext;
  hidden: Set<string>;
  leaving: boolean;
  onRetryPicks: () => void;
}) {
  const status = pickStatus(page, ctx.picked);
  const feedback = status.done && (
    <PickFeedback page={page} correct={status.correct} ctx={ctx} onRetry={onRetryPicks} />
  );
  return page.pick?.showAs === 'text' ? (
    <div className="cp-canvascol">
      <CanvasStage page={page} layout={layout} ctx={ctx} hidden={hidden} leaving={leaving} />
      {feedback}
    </div>
  ) : (
    <CanvasStage
      page={page}
      layout={layout}
      ctx={ctx}
      hidden={hidden}
      leaving={leaving}
      overlay={feedback}
    />
  );
}

function freshState(doc: CourseDoc): PlayState {
  const skip = choosePool(doc);
  const first = doc.pages.find((p) => !skip.includes(p.id));
  return {
    v: 1,
    pageId: first?.id ?? '',
    visited: [],
    answers: {},
    skip,
    vars: initialVars(doc),
    vis: {},
  };
}

const answered = (b: Block, state: PlayState) => !!state.answers[b.id]?.correct;

function mustAnswer(b: Block): boolean {
  switch (b.type) {
    case 'check':
    case 'drag':
    case 'match':
    case 'blank':
    case 'written':
    case 'likert':
      return b.required;
    default:
      return false;
  }
}

export function Player({
  doc,
  lms,
  layout: forced,
}: {
  doc: CourseDoc;
  lms: Lms;
  layout?: Layout;
}) {
  const detected = useCanvasLayout(doc.screens);
  const layout = forced ?? detected;
  const [state, setState] = useState<PlayState>(() => {
    const saved = lms.load();
    return saved && doc.pages.some((p) => p.id === saved.pageId) ? saved : freshState(doc);
  });
  const [ended, setEnded] = useState(false);
  const [popup, setPopup] = useState<string | null>(null);
  const [cueTimes, setCueTimes] = useState<Record<string, number>>({});
  const [leaving, setLeaving] = useState(false);
  const dispatchRef = useRef<(event: TriggerEvent) => void>(() => {});

  const pages = useMemo(
    () => doc.pages.filter((p) => !(state.skip ?? []).includes(p.id)),
    [doc.pages, state.skip],
  );
  const index = Math.max(
    0,
    pages.findIndex((p) => p.id === state.pageId),
  );
  const page = pages[index];
  const settings = resultsSettings(doc);
  const results = computeResults(doc, state.answers, state.skip ?? []);
  const onResultsPage = !!page?.blocks.some((b) => b.type === 'results');

  useEffect(() => {
    if (!page) return;
    setState((s) => (s.visited.includes(page.id) ? s : { ...s, visited: [...s.visited, page.id] }));
  }, [page]);

  useEffect(() => {
    if (pages.length) lms.save(state, Math.min(1, state.visited.length / pages.length));
  }, [state, lms, pages.length]);

  const pageId = page?.id;
  useEffect(() => {
    if (pageId) dispatchRef.current({ kind: 'pageStart' });
  }, [pageId]);

  useEffect(() => {
    if (onResultsPage && results.passed)
      lms.finish(results.score === null ? 'completed' : 'passed', results.score);
  }, [onResultsPage, results.passed, results.score, lms]);

  if (!page) return <div className="cp cp-shell" />;

  const show = (pageId: string) => {
    setLeaving(false);
    setState((s) => ({ ...s, pageId }));
    window.scrollTo(0, 0);
  };

  const go = (pageId: string) => {
    setPopup(null);
    if (!hasExit(page) || leaving) return show(pageId);
    setLeaving(true);
    window.setTimeout(() => show(pageId), OUT_MS);
  };

  const finish = () => {
    if (results.passed) lms.finish(results.score === null ? 'completed' : 'passed', results.score);
    if (!settings) setEnded(true);
  };

  const next = () => (index < pages.length - 1 ? go(pages[index + 1].id) : finish());

  const act = (a: Action) => {
    if (a.kind === 'next') next();
    else if (a.kind === 'prev') {
      if (index > 0) go(pages[index - 1].id);
    } else if (a.kind === 'page') go(a.pageId);
    else if (a.kind === 'popup') setPopup(a.blockId);
    else if (a.kind === 'closePopup') setPopup(null);
    else if (a.kind === 'link') window.open(a.url, '_blank', 'noopener');
    else if (a.kind === 'finish') finish();
  };

  const retry = () => {
    setEnded(false);
    setPopup(null);
    setState(freshState(doc));
  };

  const picked = state.picks?.[page.id] ?? [];
  const setPicks = (ids: string[]) =>
    setState((s) => ({ ...s, picks: { ...s.picks, [page.id]: ids } }));
  const vars: Vars = state.vars ?? initialVars(doc);

  const dispatch = (first: TriggerEvent, base: Vars = vars) => {
    let nextVars = base;
    const vis = { ...state.vis };
    let picks = picked;
    let navigate: Action | null = null;
    const queue: TriggerEvent[] = [first];
    for (let n = 0; queue.length && n < 50; n++) {
      const ev = queue.shift()!;
      for (const t of page.triggers) {
        if (!eventMatches(t.when, ev) || !passes(t.conditions, nextVars, doc)) continue;
        const a = t.action;
        if (a.kind === 'set') {
          nextVars = applySet(nextVars, doc, a.varId, a.op, a.value);
          queue.push({ kind: 'varChange', varId: a.varId });
        } else if (a.kind === 'show' || a.kind === 'hide') vis[a.blockId] = a.kind === 'show';
        else if (a.kind === 'pick') {
          const target = ev.kind === 'click' && page.blocks.find((b) => b.id === ev.blockId);
          if (target) picks = togglePick(page, picks, target);
        } else if (a.kind === 'popup' || a.kind === 'closePopup') act(a);
        else navigate = a;
      }
    }
    setState((s) => ({ ...s, vars: nextVars, vis, picks: { ...s.picks, [page.id]: picks } }));
    if (navigate) act(navigate);
  };
  dispatchRef.current = dispatch;

  const clickable = new Set(
    page.triggers.flatMap((t) => (t.when.kind === 'click' ? [t.when.blockId] : [])),
  );
  const hidden = cueHidden(page, cueTimes);
  for (const b of page.blocks) if (!(state.vis?.[b.id] ?? !b.startHidden)) hidden.add(b.id);

  const blocked =
    page.blocks.some((b) => mustAnswer(b) && !answered(b, state)) ||
    (pickBlocks(page) && !pickStatus(page, picked).correct);

  const ctx: BlockContext = {
    edit: false,
    answers: state.answers,
    answer: (blockId, selected, correct) =>
      setState((s) => {
        const prev = s.answers[blockId];
        return {
          ...s,
          answers: {
            ...s.answers,
            [blockId]: { selected, correct, firstCorrect: prev ? prev.firstCorrect : correct },
          },
        };
      }),
    next,
    act,
    picked,
    clicked: state.clicked ?? [],
    picksCorrect: pickStatus(page, picked).correct,
    click: (b) => {
      setState((s) =>
        s.clicked?.includes(b.id) ? s : { ...s, clicked: [...(s.clicked ?? []), b.id] },
      );
      dispatch({ kind: 'click', blockId: b.id });
    },
    openPopup: setPopup,
    audioProgress: (blockId, seconds) =>
      setCueTimes((c) => (seconds > (c[blockId] ?? -1) ? { ...c, [blockId]: seconds } : c)),
    results: () => results,
    retry,
    mediaEnded: (blockId) => dispatch({ kind: 'mediaEnd', blockId }),
    setVar: (varId, value) => dispatch({ kind: 'varChange', varId }, { ...vars, [varId]: value }),
    passes: (conditions) => passes(conditions, vars, doc),
    merge: (text, html) =>
      mergeText(
        text,
        vars,
        doc,
        { score: results.score === null ? '' : String(results.score) },
        html,
      ),
    clickable,
    canLeave: !blocked,
    textStyle: (style) => textStyleCss(style, doc),
  };

  const last = index === pages.length - 1;
  const openPopup = page.blocks.find((b): b is PopupBlock => b.type === 'popup' && b.id === popup);

  if (ended) {
    return (
      <div className="cp cp-shell" style={accentStyle(doc)}>
        <main className="cp-main">
          <div className="cp-flow cp-done">
            {results.passed ? (
              <>
                <h1 className="cp-h1">Course complete</h1>
                {results.score !== null && <p className="cp-text">You scored {results.score}%.</p>}
              </>
            ) : (
              <>
                <h1 className="cp-h1">Not quite</h1>
                <p className="cp-text">
                  You scored {results.score}%. You need {doc.passMark}% to pass.
                </p>
                <div className="cp-btnrow">
                  <button type="button" className="cp-btn cp-btn-solid" onClick={retry}>
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cp cp-shell" style={accentStyle(doc)}>
      {doc.fonts.length > 0 && <style>{fontFaces(doc)}</style>}
      <main
        key={page.id}
        className={[
          'cp-main',
          'cp-main-canvas',
          page.transition && page.transition !== 'none' && `cp-tr-${page.transition}`,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <PageBody
          key={page.id}
          page={page}
          layout={layout}
          ctx={ctx}
          hidden={hidden}
          leaving={leaving}
          onRetryPicks={() => setPicks([])}
        />
      </main>
      {openPopup && <PopupLayer block={openPopup} onClose={() => setPopup(null)} />}
      {doc.navBar && (
        <nav className="cp-nav">
          <button
            type="button"
            className="cp-navbtn"
            disabled={index === 0}
            onClick={() => go(pages[index - 1].id)}
          >
            Back
          </button>
          <div className="cp-prog">
            <i style={{ width: `${((index + 1) / pages.length) * 100}%` }} />
          </div>
          <span className="cp-count">
            {index + 1} of {pages.length}
          </span>
          {!(last && onResultsPage) && (
            <button
              type="button"
              className="cp-navbtn cp-navbtn-next"
              disabled={blocked}
              title={blocked ? 'Finish this page to continue' : undefined}
              onClick={next}
            >
              {last ? 'Finish' : 'Continue'}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
