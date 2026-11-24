import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  groupsOf,
  inPopup,
  type Block,
  type Frame,
  type Group,
  type HoverLook,
  type Layout,
  type Page,
} from './doc';
import { BlockView } from './blocks';
import type { BlockContext } from './context';
import {
  backdropClass,
  baseOf,
  frameFor,
  frameStyle,
  groupFrame,
  growsToFit,
  lookFor,
  pagePaint,
} from './canvasLayout';
import { animClass, animStyle } from './anim';
import { centreInside } from './geometry';
import { hoverThrough, passThrough } from './hit';
import { paintCss } from './typography';

interface HoverUnit {
  key: string;
  base: string;
  members: string[];
  hover: HoverLook;
  box: Frame;
}

const area = (f: Frame) => f.w * f.h;

function hoverUnits(page: Page, layout: Layout, groups: Group[]): HoverUnit[] {
  const grouped = new Set(groups.flatMap((g) => g.members));
  const units: HoverUnit[] = groups
    .filter((g) => g.interact && g.interact.hover !== 'none')
    .map((g) => ({
      key: g.id,
      base: baseOf(page, g, layout),
      members: g.members,
      hover: g.interact!.hover,
      box: groupFrame(page, g, layout),
    }));
  const taken = new Set(grouped);
  page.blocks.forEach((b, i) => {
    const hover = b.interact?.hover ?? 'none';
    if (hover === 'none' || taken.has(b.id) || b.type === 'button') return;
    const box = frameFor(page, b, layout);
    const riders = page.blocks
      .slice(i + 1)
      .filter((o) => {
        if (taken.has(o.id) || inPopup(o)) return false;
        const f = frameFor(page, o, layout);
        return area(f) < area(box) && centreInside(box, f);
      })
      .map((o) => o.id);
    if (!riders.length) return;
    riders.forEach((id) => taken.add(id));
    units.push({ key: b.id, base: b.id, members: [b.id, ...riders], hover, box });
  });
  return units;
}

function groupClass(group: Group, base: boolean, ctx: BlockContext): string {
  const i = group.interact;
  if (!i || !base || i.visited === 'none' || !ctx.clicked.includes(group.id)) return '';
  return `cp-visited-${i.visited}`;
}

function hoverClass(unit: HoverUnit | undefined, id: string, hot: string | null): string {
  if (!unit || hot !== unit.key) return '';
  return `cp-g-${unit.hover}${unit.base === id ? ' cp-gbase' : ''}`;
}

function scaleOrigin(f: Frame, group: Frame): CSSProperties | undefined {
  if (f.r) return undefined;
  const x = ((group.x + group.w / 2 - f.x) / f.w) * 100;
  const y = ((group.y + group.h / 2 - f.y) / f.h) * 100;
  return { transformOrigin: `${x}% ${y}%` };
}

function objectClass(block: Block, ctx: BlockContext, ownHover: boolean): string {
  const i = block.interact;
  const clickable = block.type !== 'button' && ctx.clickable.has(block.id);
  const round = block.type === 'shape' && block.shape === 'ellipse';
  if (!i) return ['cp-obj', clickable && 'cp-click', round && 'cp-round'].filter(Boolean).join(' ');
  const picked = ctx.picked.includes(block.id);
  const dimmed = !picked && ctx.picked.length > 0 && i.picked === 'dim';
  return [
    'cp-obj',
    round && 'cp-round',
    ownHover && i.hover !== 'none' && `cp-hover-${i.hover}`,
    clickable && 'cp-click',
    picked && i.picked !== 'none' && i.picked !== 'dim' && `cp-picked-${i.picked}`,
    dimmed && 'cp-dim',
    i.visited !== 'none' && ctx.clicked.includes(block.id) && !picked && `cp-visited-${i.visited}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = outer?.firstElementChild as HTMLElement | null;
    const content = inner?.firstElementChild as HTMLElement | null;
    if (!outer || !inner || !content) return;
    const fit = () => {
      inner.style.height = '';
      inner.style.transform = '';
      const s = Math.min(
        outer.clientHeight / content.scrollHeight,
        outer.clientWidth / content.scrollWidth,
      );
      if (!(s < 0.99)) return;
      inner.style.height = `${100 / s}%`;
      inner.style.transform = `scale(${s})`;
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(outer);
    resize.observe(content);
    const mutate = new MutationObserver(fit);
    mutate.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    content.addEventListener('load', fit, true);
    document.fonts.addEventListener('loadingdone', fit);
    return () => {
      resize.disconnect();
      mutate.disconnect();
      content.removeEventListener('load', fit, true);
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, []);

  return (
    <div ref={box} className="cp-fit">
      <div className="cp-fit-in">{children}</div>
    </div>
  );
}

function Grow({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = box.current;
    const content = outer?.firstElementChild as HTMLElement | null;
    const stage = outer?.closest<HTMLElement>('.cp-stage');
    if (!outer || !content || !stage) return;
    const squeeze = (rows: HTMLElement[], z: string) => rows.forEach((r) => (r.style.zoom = z));
    const fit = () => {
      outer.style.transform = '';
      const rows = [...content.querySelectorAll<HTMLElement>('.cp-squeeze')];
      squeeze(rows, '');
      let top = 0;
      for (let el: Element | null = outer; el && el !== stage; el = (el as HTMLElement).offsetParent)
        top += (el as HTMLElement).offsetTop;
      let room = stage.clientHeight - top;
      const frame = parseFloat(getComputedStyle(outer.parentElement!).minHeight);
      if (rows.length && frame > 0 && content.offsetHeight > frame + 0.5) {
        rows.forEach((r) => (r.style.display = 'none'));
        const rest = content.offsetHeight;
        rows.forEach((r) => (r.style.display = ''));
        let lo = 0.6;
        let hi = 1;
        for (let i = 0; i < 6; i++) {
          const z = (lo + hi) / 2;
          squeeze(rows, String(z));
          if (content.offsetHeight <= frame + 0.5) lo = z;
          else hi = z;
        }
        squeeze(rows, String(lo));
        room = Math.min(room, Math.max(frame, rest));
      }
      const s = room / content.offsetHeight;
      if (s > 0 && s < 0.99) outer.style.transform = `scale(${s})`;
      mutate.takeRecords();
    };
    const mutate = new MutationObserver(fit);
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(stage);
    resize.observe(content);
    mutate.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    return () => {
      resize.disconnect();
      mutate.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="cp-grow">
      {children}
    </div>
  );
}

const decorative = (b: Block) =>
  b.type === 'image' || b.type === 'heading' || (b.type === 'text' && !/<a\s/i.test(b.html));

function clickThrough(page: Page, layout: Layout, clickable: Set<string>): Set<string> {
  const out = new Set<string>();
  page.blocks.forEach((b, i) => {
    if (clickable.has(b.id) || !decorative(b)) return;
    const f = frameFor(page, b, layout);
    const over = page.blocks
      .slice(0, i)
      .some((c) => clickable.has(c.id) && centreInside(frameFor(page, c, layout), f));
    if (over) out.add(b.id);
  });
  return out;
}

export function CanvasStage({
  page,
  layout,
  ctx,
  renderObject,
  overlay,
  hidden,
  leaving = false,
  layer = null,
  onBackdrop,
}: {
  page: Page;
  layout: Layout;
  ctx: BlockContext;
  renderObject?: (block: Block, frame: Frame, content: ReactNode) => ReactNode;
  overlay?: ReactNode;
  hidden?: Set<string>;
  leaving?: boolean;
  layer?: string | null;
  onBackdrop?: () => void;
}) {
  const throughTo = clickThrough(page, layout, ctx.clickable);
  const [hot, setHot] = useState<string | null>(null);
  const moving = useRef(0);
  const groups = groupsOf(page);
  const groupBy = new Map(groups.flatMap((g) => g.members.map((id) => [id, g] as const)));
  const bases = new Set(groups.map((g) => baseOf(page, g, layout)));
  const units = hoverUnits(page, layout, groups);
  const unitOf = new Map(units.flatMap((u) => u.members.map((id) => [id, u] as const)));
  const card = page.blocks.find(
    (b) => b.id === layer && b.type === 'popup' && (ctx.edit || !b.hidden),
  );
  const object = (b: Block) => {
    const frame = frameFor(page, b, layout);
    const shown = lookFor(b, layout);
    const view = <BlockView block={shown} ctx={ctx} />;
    const content = growsToFit(b) ? <Grow>{view}</Grow> : <Fit>{view}</Fit>;
    if (renderObject) return renderObject(shown, frame, content);
    const g = groupBy.get(b.id);
    const own = b.type !== 'button' && ctx.clickable.has(b.id);
    const viaGroup = !!g && b.type !== 'button' && ctx.clickable.has(g.id);
    const clickable = own || viaGroup;
    const click = () => {
      if (own) ctx.click(b.id);
      if (viaGroup) ctx.click(g.id);
    };
    const unit = unitOf.get(b.id);
    const look = [
      g ? groupClass(g, bases.has(b.id), ctx) : '',
      hoverClass(unit, b.id, hot),
      viaGroup && !own ? 'cp-click' : '',
    ].join(' ');
    return (
      <div
        key={b.id}
        className={`${objectClass(b, ctx, !unit)} ${backdropClass(b, frame)} ${look} ${animClass(b, leaving, !!hidden?.has(b.id))}${throughTo.has(b.id) && !viaGroup ? ' cp-through' : ''}`}
        style={{
          ...frameStyle(frame, growsToFit(b)),
          ...animStyle(b),
          ...(unit?.hover === 'scale' ? scaleOrigin(frame, unit.box) : {}),
        }}
        onClick={clickable ? click : undefined}
        onPointerEnter={unit ? () => setHot(unit.key) : undefined}
        onPointerLeave={unit ? () => setHot(null) : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), click())
            : undefined
        }
      >
        {content}
      </div>
    );
  };
  return (
    <div className={`cp-stagewrap cp-stagewrap-${layout}`}>
      <div
        className={`cp-stage cp-stage-${layout}`}
        style={paintCss(...pagePaint(page, layout))}
        onPointerDownCapture={
          ctx.edit
            ? undefined
            : (e) => {
                if (!passThrough(e.nativeEvent, '.cp-obj')) return;
                e.stopPropagation();
                e.preventDefault();
              }
        }
        onPointerMove={
          ctx.edit
            ? undefined
            : (e) => {
                if (e.buttons || moving.current) return;
                const { currentTarget: stage, clientX: x, clientY: y } = e;
                moving.current = requestAnimationFrame(() => {
                  moving.current = 0;
                  hoverThrough(stage, x, y, '.cp-obj');
                });
              }
        }
        onPointerLeave={
          ctx.edit ? undefined : (e) => hoverThrough(e.currentTarget, -1, -1, '.cp-obj')
        }
      >
        {page.blocks.map((b) =>
          inPopup(b) || b.hidden ? <div key={b.id} className="cp-obj" hidden /> : object(b),
        )}
        {card && (
          <>
            <div className="cp-backdrop" onClick={onBackdrop} />
            {object(card)}
            {page.blocks.filter((b) => b.parent === card.id && !b.hidden).map(object)}
          </>
        )}
        {overlay}
      </div>
    </div>
  );
}
