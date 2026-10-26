import { useEffect, useMemo, useState } from 'react';
import { scoredQuestions, type CourseDoc, type Layout, type Page } from './doc';
import type { Lms, PlayState } from './scorm';
import { BlockView, type BlockContext } from './blocks';
import { accentStyle } from './util';
import { CanvasStage } from './canvas';
import { useCanvasLayout } from './canvasLayout';

function PageBody({ page, layout, ctx }: { page: Page; layout: Layout; ctx: BlockContext }) {
  if (page.kind === 'canvas') return <CanvasStage page={page} layout={layout} ctx={ctx} />;
  return (
    <div className="cp-flow">
      {page.blocks.map((b) => (
        <BlockView key={b.id} block={b} ctx={ctx} />
      ))}
    </div>
  );
}

function freshState(doc: CourseDoc): PlayState {
  return { v: 1, pageId: doc.pages[0]?.id ?? '', visited: [], answers: {} };
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
  const [result, setResult] = useState<{
    score: number | null;
    passed: boolean;
  } | null>(null);

  const index = Math.max(
    0,
    doc.pages.findIndex((p) => p.id === state.pageId),
  );
  const page = doc.pages[index];

  useEffect(() => {
    if (!page) return;
    setState((s) => (s.visited.includes(page.id) ? s : { ...s, visited: [...s.visited, page.id] }));
  }, [page]);

  useEffect(() => {
    if (doc.pages.length) lms.save(state, Math.min(1, state.visited.length / doc.pages.length));
  }, [state, lms, doc.pages.length]);

  const scored = useMemo(() => scoredQuestions(doc), [doc]);

  if (!page) return <div className="cp cp-shell" />;

  const go = (pageId: string) => {
    setState((s) => ({ ...s, pageId }));
    window.scrollTo(0, 0);
  };

  const finish = () => {
    if (scored.length && doc.passMark !== null) {
      const right = scored.filter((q) => state.answers[q.id]?.firstCorrect).length;
      const score = Math.round((right / scored.length) * 100);
      const passed = score >= doc.passMark;
      if (passed) lms.finish('passed', score);
      setResult({ score, passed });
    } else {
      lms.finish('completed', null);
      setResult({ score: null, passed: true });
    }
  };

  const retry = () => {
    setResult(null);
    setState(freshState(doc));
  };

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
            [blockId]: {
              selected,
              correct,
              firstCorrect: prev ? prev.firstCorrect : correct,
            },
          },
        };
      }),
    next: () => (index < doc.pages.length - 1 ? go(doc.pages[index + 1].id) : finish()),
    goTo: go,
  };

  const blocked = page.blocks.some(
    (b) => b.type === 'check' && b.required && !state.answers[b.id]?.correct,
  );
  const last = index === doc.pages.length - 1;

  if (result) {
    return (
      <div className="cp cp-shell" style={accentStyle(doc)}>
        <main className="cp-main">
          <div className="cp-flow cp-done">
            {result.passed ? (
              <>
                <h1 className="cp-h1">Course complete</h1>
                {result.score !== null && <p className="cp-text">You scored {result.score}%.</p>}
              </>
            ) : (
              <>
                <h1 className="cp-h1">Not quite</h1>
                <p className="cp-text">
                  You scored {result.score}%. You need {doc.passMark}% to pass.
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
      <main className={page.kind === 'canvas' ? 'cp-main cp-main-canvas' : 'cp-main'}>
        <PageBody key={page.id} page={page} layout={layout} ctx={ctx} />
      </main>
      <nav className="cp-nav">
        <button
          type="button"
          className="cp-navbtn"
          disabled={index === 0}
          onClick={() => go(doc.pages[index - 1].id)}
        >
          Back
        </button>
        <div className="cp-prog">
          <i style={{ width: `${((index + 1) / doc.pages.length) * 100}%` }} />
        </div>
        <span className="cp-count">
          {index + 1} of {doc.pages.length}
        </span>
        <button
          type="button"
          className="cp-navbtn cp-navbtn-next"
          disabled={blocked}
          title={blocked ? 'Answer the question to continue' : undefined}
          onClick={ctx.next}
        >
          {last ? 'Finish' : 'Continue'}
        </button>
      </nav>
    </div>
  );
}
