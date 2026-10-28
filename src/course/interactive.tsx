import { useLayoutEffect, useRef, useState } from 'react';
import type {
  AccordionBlock,
  FlipBlock,
  HotspotBlock,
  PathwayBlock,
  PopupBlock,
  TabsBlock,
} from './doc';
import type { BlockContext } from './context';
import { sanitizeHtml } from './sanitize';

const Html = ({ html, className = 'cp-text' }: { html: string; className?: string }) => (
  <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
);

export function PopupTrigger({ block, ctx }: { block: PopupBlock; ctx: BlockContext }) {
  if (!block.showButton)
    return ctx.edit ? <div className="cp-empty">Pop-up: {block.title}</div> : null;
  return (
    <div className="cp-btnrow">
      <button
        type="button"
        className="cp-btn cp-btn-outline"
        onClick={() => !ctx.edit && ctx.openPopup(block.id)}
      >
        {block.label}
      </button>
    </div>
  );
}

function useShrinkToFit() {
  const card = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const c = card.current;
      const b = body.current;
      if (!c || !b) return;
      b.style.zoom = '';
      const style = getComputedStyle(c);
      const room =
        parseFloat(style.maxHeight) -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      if (b.scrollHeight > room) b.style.zoom = String(room / b.scrollHeight);
    };
    fit();
    const b = body.current;
    window.addEventListener('resize', fit);
    b?.addEventListener('load', fit, true);
    return () => {
      window.removeEventListener('resize', fit);
      b?.removeEventListener('load', fit, true);
    };
  }, []);
  return { card, body };
}

export function PopupLayer({ block, onClose }: { block: PopupBlock; onClose: () => void }) {
  const { card, body } = useShrinkToFit();
  return (
    <div className="cp-layer" onClick={onClose}>
      <div
        ref={card}
        className="cp-layer-card"
        role="dialog"
        aria-modal="true"
        aria-label={block.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="cp-layer-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div ref={body} className="cp-layer-body">
          {block.title && <h2 className="cp-h2">{block.title}</h2>}
          {block.src && <img className="cp-img cp-img-full" src={block.src} alt="" />}
          <Html html={block.html} />
        </div>
      </div>
    </div>
  );
}

export function AccordionView({ block }: { block: AccordionBlock }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="cp-acc">
      {block.items.map((p) => (
        <div key={p.id} className={open === p.id ? 'cp-acc-item cp-acc-open' : 'cp-acc-item'}>
          <button
            type="button"
            className="cp-acc-head"
            aria-expanded={open === p.id}
            onClick={() => setOpen((o) => (o === p.id ? null : p.id))}
          >
            <span>{p.title}</span>
            <span className="cp-acc-sign">{open === p.id ? '−' : '+'}</span>
          </button>
          {open === p.id && <Html html={p.html} className="cp-text cp-acc-body" />}
        </div>
      ))}
    </div>
  );
}

export function TabsView({ block }: { block: TabsBlock }) {
  const [on, setOn] = useState(block.items[0]?.id);
  const current = block.items.find((p) => p.id === on) ?? block.items[0];
  return (
    <div className="cp-tabs">
      <div className="cp-tabbar" role="tablist">
        {block.items.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === current?.id}
            className={p.id === current?.id ? 'cp-tab cp-tab-on' : 'cp-tab'}
            onClick={() => setOn(p.id)}
          >
            {p.title}
          </button>
        ))}
      </div>
      {current && <Html html={current.html} className="cp-text cp-tabbody" />}
    </div>
  );
}

export function FlipView({ block }: { block: FlipBlock }) {
  const [flipped, setFlipped] = useState<string[]>([]);
  return (
    <div className="cp-flips">
      {block.cards.map((c) => {
        const on = flipped.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={on ? 'cp-flip cp-flipped' : 'cp-flip'}
            aria-pressed={on}
            onClick={() => setFlipped((f) => (on ? f.filter((x) => x !== c.id) : [...f, c.id]))}
          >
            <span className="cp-flip-inner">
              <span className="cp-flip-face cp-flip-front">
                {c.frontSrc && <img src={c.frontSrc} alt="" />}
                <span>{c.front}</span>
              </span>
              <span className="cp-flip-face cp-flip-back">{c.back}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function HotspotView({ block, ctx }: { block: HotspotBlock; ctx: BlockContext }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!block.src) return <div className="cp-empty">Image hotspots</div>;
  const spot = block.spots.find((s) => s.id === open);
  return (
    <div className="cp-hotspots">
      <img src={block.src} alt={block.alt} />
      {block.spots.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={open === s.id ? 'cp-pin cp-pin-on' : 'cp-pin'}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          aria-label={s.title}
          onClick={() => !ctx.edit && setOpen((o) => (o === s.id ? null : s.id))}
        >
          {i + 1}
        </button>
      ))}
      {spot && (
        <div className="cp-pinpop" role="dialog" aria-label={spot.title}>
          <button
            type="button"
            className="cp-layer-x"
            onClick={() => setOpen(null)}
            aria-label="Close"
          >
            ×
          </button>
          <p className="cp-q">{spot.title}</p>
          <Html html={spot.html} />
        </div>
      )}
    </div>
  );
}

export function PathwayView({ block, ctx }: { block: PathwayBlock; ctx: BlockContext }) {
  return (
    <div className="cp-check">
      <p className="cp-q">{block.prompt}</p>
      <div className="cp-opts">
        {block.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className="cp-opt"
            onClick={() => !ctx.edit && c.pageId && ctx.act({ kind: 'page', pageId: c.pageId })}
          >
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
