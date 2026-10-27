import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  BlankBlock,
  CheckBlock,
  DragBlock,
  GradedBlock,
  LikertBlock,
  MatchBlock,
  ResultsBlock,
  SliderBlock,
  WrittenBlock,
} from './doc';
import type { BlockContext } from './context';
import { BLANK, blankAnswers } from './grading';
import { shuffled } from './util';

function QuestionFrame({
  block,
  ctx,
  prompt,
  hint,
  response,
  correct,
  ready,
  onReset,
  children,
}: {
  block: GradedBlock;
  ctx: BlockContext;
  prompt: string;
  hint?: string;
  response: string[];
  correct: boolean;
  ready: boolean;
  onReset: () => void;
  children: (state: { locked: boolean; submitted: boolean }) => ReactNode;
}) {
  const [submitted, setSubmitted] = useState(!!ctx.answers[block.id]);
  const locked = submitted || ctx.edit;
  return (
    <div className="cp-check">
      <p className="cp-q">{prompt}</p>
      {hint && <p className="cp-hint">{hint}</p>}
      {children({ locked, submitted })}
      {submitted ? (
        <>
          <div className={`cp-fb ${correct ? 'cp-fb-ok' : 'cp-fb-bad'}`}>
            {correct ? block.feedbackCorrect : block.feedbackWrong}
          </div>
          {!correct && (
            <button
              type="button"
              className="cp-btn cp-btn-outline"
              onClick={() => {
                setSubmitted(false);
                onReset();
              }}
            >
              Try again
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          className="cp-btn cp-btn-solid"
          disabled={!ready || ctx.edit}
          onClick={() => {
            setSubmitted(true);
            ctx.answer(block.id, response, correct);
          }}
        >
          Submit
        </button>
      )}
    </div>
  );
}

export function CheckView({ block, ctx }: { block: CheckBlock; ctx: BlockContext }) {
  const [selected, setSelected] = useState<string[]>(ctx.answers[block.id]?.selected ?? []);
  const options = useMemo(
    () => (block.shuffle && !ctx.edit ? shuffled(block.options) : block.options),
    [block.options, block.shuffle, ctx.edit],
  );
  const correctIds = block.options.filter((o) => o.correct).map((o) => o.id);
  const correct =
    selected.length === correctIds.length && correctIds.every((id) => selected.includes(id));

  return (
    <QuestionFrame
      block={block}
      ctx={ctx}
      prompt={block.question}
      hint={block.multiple ? 'Select all that apply.' : undefined}
      response={selected}
      correct={correct}
      ready={selected.length > 0}
      onReset={() => setSelected([])}
    >
      {({ locked, submitted }) => (
        <div className="cp-opts">
          {options.map((o) => {
            const on = selected.includes(o.id);
            const mark = submitted && on ? (o.correct ? ' cp-right' : ' cp-wrong') : '';
            return (
              <button
                key={o.id}
                type="button"
                className={`cp-opt${on ? ' cp-on' : ''}${mark}`}
                aria-pressed={on}
                onClick={() =>
                  !locked &&
                  setSelected((s) =>
                    block.multiple ? (on ? s.filter((x) => x !== o.id) : [...s, o.id]) : [o.id],
                  )
                }
              >
                <span className={block.multiple ? 'cp-box' : 'cp-dot'} />
                <span>{o.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </QuestionFrame>
  );
}

type Placement = Record<string, string>;

const toPlacement = (saved: string[] | undefined): Placement =>
  Object.fromEntries((saved ?? []).map((p) => p.split('=') as [string, string]));

const fromPlacement = (p: Placement) =>
  Object.entries(p)
    .filter(([, zone]) => zone)
    .map(([item, zone]) => `${item}=${zone}`);

function useDnd(locked: boolean, place: (itemId: string, zoneId: string) => void) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{
    text: string;
    x: number;
    y: number;
    root: Element;
    fontSize: string;
  } | null>(null);

  const tile = (id: string, text: string) => ({
    'aria-pressed': selected === id,
    onClick: (e: ReactMouseEvent) => e.stopPropagation(),
    onPointerDown: (e: ReactPointerEvent) => {
      if (locked || e.button !== 0) return;
      const sx = e.clientX;
      const sy = e.clientY;
      const root = e.currentTarget.closest('.cp') ?? document.body;
      const fontSize = getComputedStyle(e.currentTarget).fontSize;
      let moved = false;
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        moved = true;
        setGhost({ text, x: ev.clientX, y: ev.clientY, root, fontSize });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        setGhost(null);
        if (!moved) {
          setSelected((s) => (s === id ? null : id));
          return;
        }
        const zone = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .find((el) => el instanceof HTMLElement && el.dataset.zone !== undefined) as
          | HTMLElement
          | undefined;
        if (zone) place(id, zone.dataset.zone ?? '');
        setSelected(null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
    },
  });

  const zone = (zoneId: string) => ({
    'data-zone': zoneId,
    onClick: () => {
      if (!selected || locked) return;
      place(selected, zoneId);
      setSelected(null);
    },
  });

  const ghostEl =
    ghost &&
    createPortal(
      <span
        className="cp-tile cp-ghost"
        style={{ left: ghost.x, top: ghost.y, fontSize: ghost.fontSize }}
      >
        {ghost.text}
      </span>,
      ghost.root,
    );

  return { tile, zone, ghostEl, selected };
}

function DragBoard({
  items,
  zones,
  placement,
  setPlacement,
  locked,
  marks,
  layout,
  image,
}: {
  items: { id: string; text: string }[];
  zones: {
    id: string;
    label: string;
    capacity: number;
    rect?: { x: number; y: number; w: number; h: number };
  }[];
  placement: Placement;
  setPlacement: (p: Placement) => void;
  locked: boolean;
  marks: Record<string, boolean> | null;
  layout: 'slots' | 'image' | 'groups' | 'pairs';
  image?: string;
}) {
  const place = (itemId: string, zoneId: string) => {
    const next = { ...placement, [itemId]: zoneId };
    const zone = zones.find((z) => z.id === zoneId);
    if (zone && zone.capacity === 1)
      for (const [other, z] of Object.entries(next))
        if (other !== itemId && z === zoneId) next[other] = '';
    setPlacement(next);
  };
  const dnd = useDnd(locked, place);
  const tileEl = (it: { id: string; text: string }) => (
    <span
      key={it.id}
      className={[
        'cp-tile',
        dnd.selected === it.id && 'cp-tile-on',
        marks && (marks[it.id] ? 'cp-right' : 'cp-wrong'),
        locked && 'cp-tile-locked',
      ]
        .filter(Boolean)
        .join(' ')}
      {...dnd.tile(it.id, it.text)}
    >
      {it.text}
    </span>
  );
  const inZone = (zoneId: string) => items.filter((it) => (placement[it.id] ?? '') === zoneId);

  return (
    <div className={`cp-dnd cp-dnd-${layout}`}>
      {layout === 'image' && image ? (
        <div className="cp-dnd-image">
          <img src={image} alt="" />
          {zones.map((z) => (
            <div
              key={z.id}
              className="cp-zone cp-zone-abs"
              style={{
                left: `${z.rect!.x}%`,
                top: `${z.rect!.y}%`,
                width: `${z.rect!.w}%`,
                height: `${z.rect!.h}%`,
              }}
              {...dnd.zone(z.id)}
            >
              {inZone(z.id).map(tileEl)}
            </div>
          ))}
        </div>
      ) : (
        <div className="cp-zones">
          {zones.map((z) => (
            <div key={z.id} className="cp-zonewrap">
              {z.label && <span className="cp-zone-label">{z.label}</span>}
              <div className="cp-zone" {...dnd.zone(z.id)}>
                {inZone(z.id).map(tileEl)}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cp-zone cp-bank" {...dnd.zone('')}>
        {inZone('').map(tileEl)}
        {inZone('').length === 0 && <span className="cp-hint">All placed</span>}
      </div>
      {dnd.ghostEl}
    </div>
  );
}

export function DragView({ block, ctx }: { block: DragBlock; ctx: BlockContext }) {
  const [placement, setPlacement] = useState<Placement>(
    toPlacement(ctx.answers[block.id]?.selected),
  );
  const items = useMemo(
    () => (ctx.edit ? block.items : shuffled(block.items)),
    [block.items, ctx.edit],
  );

  const zones =
    block.style === 'order'
      ? block.items.map((_, i) => ({ id: `s${i}`, label: String(i + 1), capacity: 1 }))
      : block.style === 'targets'
        ? block.targets.map((t) => ({ id: t.id, label: t.label, capacity: 1, rect: t }))
        : block.groups.map((g) => ({ id: g.id, label: g.label, capacity: Infinity }));

  const wanted = (itemId: string, index: number) =>
    block.style === 'order'
      ? `s${index}`
      : (block.items.find((i) => i.id === itemId)?.target ?? '');
  const marks = Object.fromEntries(
    block.items.map((it, i) => [it.id, (placement[it.id] ?? '') === wanted(it.id, i)]),
  );
  const correct = Object.values(marks).every(Boolean);
  const placed = block.items.filter((it, i) => wanted(it.id, i) !== '' && placement[it.id]).length;

  return (
    <QuestionFrame
      block={block}
      ctx={ctx}
      prompt={block.prompt}
      hint="Drag each item into place, or tap an item then tap where it goes."
      response={fromPlacement(placement)}
      correct={correct}
      ready={placed > 0}
      onReset={() => setPlacement({})}
    >
      {({ locked, submitted }) => (
        <DragBoard
          items={items}
          zones={zones}
          placement={placement}
          setPlacement={setPlacement}
          locked={locked}
          marks={submitted ? marks : null}
          layout={
            block.style === 'order' ? 'slots' : block.style === 'targets' ? 'image' : 'groups'
          }
          image={block.src}
        />
      )}
    </QuestionFrame>
  );
}

export function MatchView({ block, ctx }: { block: MatchBlock; ctx: BlockContext }) {
  const [placement, setPlacement] = useState<Placement>(
    toPlacement(ctx.answers[block.id]?.selected),
  );
  const rights = useMemo(
    () =>
      (ctx.edit ? block.pairs : shuffled(block.pairs)).map((p) => ({ id: p.id, text: p.right })),
    [block.pairs, ctx.edit],
  );
  const marks = Object.fromEntries(block.pairs.map((p) => [p.id, placement[p.id] === p.id]));
  const correct = Object.values(marks).every(Boolean);
  const ready = Object.values(placement).some(Boolean);

  return (
    <QuestionFrame
      block={block}
      ctx={ctx}
      prompt={block.prompt}
      hint={
        block.mode === 'drag' ? 'Drag each answer next to its pair, or tap then tap.' : undefined
      }
      response={fromPlacement(placement)}
      correct={correct}
      ready={ready}
      onReset={() => setPlacement({})}
    >
      {({ locked, submitted }) =>
        block.mode === 'drag' ? (
          <DragBoard
            items={rights}
            zones={block.pairs.map((p) => ({ id: p.id, label: p.left, capacity: 1 }))}
            placement={placement}
            setPlacement={setPlacement}
            locked={locked}
            marks={submitted ? marks : null}
            layout="pairs"
          />
        ) : (
          <div className="cp-matchrows">
            {block.pairs.map((p) => {
              const chosen = Object.entries(placement).find(([, z]) => z === p.id)?.[0] ?? '';
              return (
                <label
                  key={p.id}
                  className={`cp-matchrow${submitted ? (chosen === p.id ? ' cp-right' : ' cp-wrong') : ''}`}
                >
                  <span>{p.left}</span>
                  <select
                    disabled={locked}
                    value={chosen}
                    onChange={(e) => {
                      const next = Object.fromEntries(
                        Object.entries(placement).filter(([, z]) => z !== p.id),
                      );
                      if (e.target.value) next[e.target.value] = p.id;
                      setPlacement(next);
                    }}
                  >
                    <option value="">Choose…</option>
                    {rights.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.text}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )
      }
    </QuestionFrame>
  );
}

export function BlankView({ block, ctx }: { block: BlankBlock; ctx: BlockContext }) {
  const answers = blankAnswers(block.text);
  const [values, setValues] = useState<string[]>(
    ctx.answers[block.id]?.selected ?? answers.map(() => ''),
  );
  const marks = answers.map((a, i) => a.includes((values[i] ?? '').trim().toLowerCase()));
  const correct = marks.every(Boolean);
  const parts = block.text.split(BLANK);

  return (
    <QuestionFrame
      block={block}
      ctx={ctx}
      prompt={block.prompt}
      response={values}
      correct={correct}
      ready={values.some((v) => v.trim())}
      onReset={() => setValues(answers.map(() => ''))}
    >
      {({ locked, submitted }) => (
        <p className="cp-text cp-blank">
          {parts.map((part, i) => {
            if (i % 2 === 0) return <span key={i}>{part}</span>;
            const n = (i - 1) / 2;
            return (
              <input
                key={i}
                className={`cp-blankin${submitted ? (marks[n] ? ' cp-right' : ' cp-wrong') : ''}`}
                aria-label={`Blank ${n + 1}`}
                disabled={locked}
                value={values[n] ?? ''}
                size={Math.max(6, answers[n][0].length + 2)}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === n ? e.target.value : x)))}
              />
            );
          })}
        </p>
      )}
    </QuestionFrame>
  );
}

export function SliderView({ block, ctx }: { block: SliderBlock; ctx: BlockContext }) {
  const saved = ctx.answers[block.id]?.selected[0];
  const [value, setValue] = useState(saved !== undefined ? Number(saved) : block.min);
  const [moved, setMoved] = useState(saved !== undefined);
  const correct = Math.abs(value - block.answer) <= block.tolerance;

  return (
    <QuestionFrame
      block={block}
      ctx={ctx}
      prompt={block.prompt}
      response={[String(value)]}
      correct={correct}
      ready={moved}
      onReset={() => {
        setValue(block.min);
        setMoved(false);
      }}
    >
      {({ locked, submitted }) => (
        <div className="cp-slider">
          <output
            className={`cp-slider-val${submitted ? (correct ? ' cp-right' : ' cp-wrong') : ''}`}
          >
            {value}
            {block.unit}
          </output>
          <input
            type="range"
            min={block.min}
            max={block.max}
            step={block.step}
            value={value}
            disabled={locked}
            aria-label={block.prompt}
            onChange={(e) => {
              setValue(Number(e.target.value));
              setMoved(true);
            }}
          />
          <div className="cp-slider-ends">
            <span>
              {block.min}
              {block.unit}
            </span>
            <span>
              {block.max}
              {block.unit}
            </span>
          </div>
        </div>
      )}
    </QuestionFrame>
  );
}

export function WrittenView({ block, ctx }: { block: WrittenBlock; ctx: BlockContext }) {
  const [text, setText] = useState(ctx.answers[block.id]?.selected[0] ?? '');
  const save = () => {
    ctx.answer(block.id, [text], text.trim().length > 0);
    if (block.saveTo) ctx.setVar(block.saveTo, text.trim());
  };
  return (
    <div className="cp-check">
      <label className="cp-q" htmlFor={`w-${block.id}`}>
        {block.prompt}
      </label>
      {block.length === 'essay' ? (
        <textarea
          id={`w-${block.id}`}
          className="cp-input cp-essay"
          disabled={ctx.edit}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
        />
      ) : (
        <input
          id={`w-${block.id}`}
          className="cp-input"
          disabled={ctx.edit}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
        />
      )}
    </div>
  );
}

export function LikertView({ block, ctx }: { block: LikertBlock; ctx: BlockContext }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (ctx.answers[block.id]?.selected ?? []).map((p) => {
        const [row, v] = p.split('=');
        return [row, Number(v)];
      }),
    ),
  );
  const choose = (rowId: string, v: number) => {
    if (ctx.edit) return;
    const next = { ...values, [rowId]: v };
    setValues(next);
    ctx.answer(
      block.id,
      Object.entries(next).map(([r, x]) => `${r}=${x}`),
      block.rows.every((r) => next[r.id] !== undefined),
    );
  };
  return (
    <div className="cp-check">
      <p className="cp-q">{block.prompt}</p>
      <div className="cp-likert">
        {block.rows.map((r) => (
          <fieldset key={r.id} className="cp-likert-row">
            <legend>{r.text}</legend>
            <div className="cp-likert-scale">
              {block.scale.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={values[r.id] === i ? 'cp-likert-opt cp-on' : 'cp-likert-opt'}
                  aria-pressed={values[r.id] === i}
                  onClick={() => choose(r.id, i)}
                >
                  <span className="cp-dot" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

export function ResultsView({ block, ctx }: { block: ResultsBlock; ctx: BlockContext }) {
  const r = ctx.results();
  return (
    <div className="cp-results">
      <p className="cp-results-score">{r.score === null ? 'Complete' : `${r.score}%`}</p>
      {r.passMark !== null && <p className="cp-hint">Pass mark {r.passMark}%</p>}
      <p className="cp-text">{r.passed ? block.passText : block.failText}</p>
      {!r.passed && block.retry && (
        <div className="cp-btnrow">
          <button
            type="button"
            className="cp-btn cp-btn-solid"
            onClick={() => !ctx.edit && ctx.retry()}
          >
            Try again
          </button>
        </div>
      )}
      {block.review && r.review.length > 0 && (
        <ul className="cp-review">
          {r.review.map((q) => (
            <li key={q.id} className={q.correct ? 'cp-right' : 'cp-wrong'}>
              <span>{q.correct ? '✓' : '✗'}</span> {q.prompt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
