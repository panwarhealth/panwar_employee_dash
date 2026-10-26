import { useMemo, useState } from 'react';
import type { Block, ButtonAction, CheckBlock } from './doc';
import type { Answer } from './scorm';
import { sanitizeHtml } from './sanitize';
import { embedUrl } from './util';

export interface BlockContext {
  edit: boolean;
  answers: Record<string, Answer>;
  answer(blockId: string, selected: string[], correct: boolean): void;
  next(): void;
  act(action: ButtonAction): void;
  picked: string[];
  clicked: string[];
  picksCorrect: boolean;
  click(block: Block): void;
}

export function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h1' : 'h2';
      return <Tag className={`cp-h${block.level} cp-${block.align}`}>{block.text}</Tag>;
    }
    case 'text':
      return (
        <div
          className={`cp-text cp-${block.align}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
        />
      );
    case 'image':
      return block.src ? (
        <img className={`cp-img cp-img-${block.size}`} src={block.src} alt={block.alt} />
      ) : (
        <div className="cp-empty">Image</div>
      );
    case 'video':
      return block.src ? (
        <video className="cp-video" src={block.src} controls playsInline preload="metadata">
          {block.captions && <track kind="captions" src={block.captions} default />}
        </video>
      ) : (
        <div className="cp-empty">Video</div>
      );
    case 'embed': {
      const src = embedUrl(block.url);
      return src ? (
        <div className="cp-embed">
          <iframe
            src={src}
            title="Embedded content"
            allow="fullscreen; autoplay; encrypted-media"
          />
        </div>
      ) : (
        <div className="cp-empty">Embed</div>
      );
    }
    case 'divider':
      return <hr className="cp-divider" />;
    case 'button':
      return (
        <div className="cp-btnrow">
          <button
            type="button"
            className={`cp-btn cp-btn-${block.style}`}
            disabled={!ctx.edit && block.enabledWhen === 'picks' && !ctx.picksCorrect}
            onClick={() => !ctx.edit && ctx.act(block.action)}
          >
            {block.label}
          </button>
        </div>
      );
    case 'check':
      return <CheckView block={block} ctx={ctx} />;
  }
}

function CheckView({ block, ctx }: { block: CheckBlock; ctx: BlockContext }) {
  const saved = ctx.answers[block.id];
  const [selected, setSelected] = useState<string[]>(saved?.selected ?? []);
  const [submitted, setSubmitted] = useState(!!saved);
  const options = useMemo(
    () => (block.shuffle && !ctx.edit ? shuffled(block.options) : block.options),
    [block.options, block.shuffle, ctx.edit],
  );
  const correctIds = block.options.filter((o) => o.correct).map((o) => o.id);
  const isCorrect =
    selected.length === correctIds.length && correctIds.every((id) => selected.includes(id));
  const locked = submitted || ctx.edit;

  const toggle = (id: string) => {
    if (locked) return;
    setSelected((s) =>
      block.multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id],
    );
  };

  return (
    <div className="cp-check">
      <p className="cp-q">{block.question}</p>
      {block.multiple && <p className="cp-hint">Select all that apply.</p>}
      <div className="cp-opts">
        {options.map((o) => {
          const on = selected.includes(o.id);
          const mark = submitted && on ? (o.correct ? ' cp-right' : ' cp-wrong') : '';
          return (
            <button
              key={o.id}
              type="button"
              className={`cp-opt${on ? ' cp-on' : ''}${mark}`}
              onClick={() => toggle(o.id)}
              aria-pressed={on}
            >
              <span className={block.multiple ? 'cp-box' : 'cp-dot'} />
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {submitted ? (
        <>
          <div className={`cp-fb ${isCorrect ? 'cp-fb-ok' : 'cp-fb-bad'}`}>
            {isCorrect ? block.feedbackCorrect : block.feedbackWrong}
          </div>
          {!isCorrect && (
            <button
              type="button"
              className="cp-btn cp-btn-outline"
              onClick={() => {
                setSubmitted(false);
                setSelected([]);
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
          disabled={selected.length === 0 || ctx.edit}
          onClick={() => {
            setSubmitted(true);
            ctx.answer(block.id, selected, isCorrect);
          }}
        >
          Submit
        </button>
      )}
    </div>
  );
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
