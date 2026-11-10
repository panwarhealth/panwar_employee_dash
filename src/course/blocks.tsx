import type { Block } from './doc';
import type { BlockContext } from './context';
import { sanitizeHtml } from './sanitize';
import { borderCss, boxCss, paintCss, px, radiusCss, shadowCss } from './typography';
import { embedUrl } from './util';
import { AnimationView, AudioView } from './media';
import { RevealView } from './reveal';
import {
  AccordionView,
  FlipView,
  HotspotView,
  PathwayView,
  PopupTrigger,
  TabsView,
} from './interactive';
import {
  BlankView,
  CheckView,
  DragView,
  LikertView,
  MatchView,
  ResultsView,
  SliderView,
  WrittenView,
} from './questions';

export function BlockView({ block, ctx }: { block: Block; ctx: BlockContext }) {
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h1' : 'h2';
      return (
        <Tag
          className={`cp-h${block.level} cp-${block.align}`}
          style={{
            ...boxCss(block),
            ...ctx.textStyle(block.textStyle),
          }}
        >
          {ctx.merge(block.text, false)}
        </Tag>
      );
    }
    case 'text':
      return (
        <div
          className={`cp-text cp-${block.align}`}
          style={{
            ...boxCss(block),
            ...ctx.textStyle(block.textStyle),
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ctx.merge(block.html, true)) }}
        />
      );
    case 'image': {
      const blur = block.blur ? { filter: `blur(${px(block.blur)})` } : {};
      const bleed = px((block.blur ?? 0) * 2);
      if (block.src && block.crop) {
        const [t, r, b, l] = block.crop;
        return (
          <div
            className="cp-crop"
            style={{
              ...radiusCss(block.radius, block.corners),
              ...borderCss(block.border),
              ...paintCss(block.fill, block.gradient),
              ...shadowCss(block.shadow, 'image'),
            }}
          >
            <img
              src={block.src}
              alt={block.alt}
              style={{
                left: `calc(${(-l / (100 - l - r)) * 100}% - ${bleed})`,
                top: `calc(${(-t / (100 - t - b)) * 100}% - ${bleed})`,
                width: `calc(${(100 / (100 - l - r)) * 100}% + 2 * ${bleed})`,
                height: `calc(${(100 / (100 - t - b)) * 100}% + 2 * ${bleed})`,
                ...blur,
              }}
            />
          </div>
        );
      }
      const look = `cp-img cp-img-${block.size}${block.fill || block.gradient ? ' cp-img-fill' : ''}`;
      if (block.src && block.blur)
        return (
          <div
            className="cp-crop"
            style={{
              ...radiusCss(block.radius, block.corners),
              ...borderCss(block.border),
              ...shadowCss(block.shadow, 'image'),
            }}
          >
            <img
              className={look}
              style={{
                ...paintCss(block.fill, block.gradient),
                ...(block.stretch ? { objectFit: 'fill' } : {}),
                left: `calc(-1 * ${bleed})`,
                top: `calc(-1 * ${bleed})`,
                width: `calc(100% + 2 * ${bleed})`,
                height: `calc(100% + 2 * ${bleed})`,
                ...blur,
              }}
              src={block.src}
              alt={block.alt}
            />
          </div>
        );
      return block.src ? (
        <img
          className={look}
          style={{
            ...paintCss(block.fill, block.gradient),
            ...shadowCss(block.shadow, 'image'),
            ...radiusCss(block.radius, block.corners),
            ...borderCss(block.border),
            ...(block.stretch ? { objectFit: 'fill' } : {}),
          }}
          src={block.src}
          alt={block.alt}
        />
      ) : (
        <div className="cp-empty">Image</div>
      );
    }
    case 'video':
      return block.src ? (
        <video
          className="cp-video"
          src={block.src}
          controls
          playsInline
          preload="metadata"
          onEnded={() => ctx.mediaEnded(block.id)}
        >
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
    case 'shape':
      return (
        <div
          className="cp-shape"
          style={{
            ...paintCss(block.fill, block.gradient),
            ...borderCss(block.border),
            ...(block.shape === 'ellipse'
              ? { borderRadius: '50%' }
              : radiusCss(block.radius, block.corners)),
            ...shadowCss(block.shadow, 'box'),
            ...(block.blur
              ? {
                  backdropFilter: `blur(${px(block.blur)})`,
                  WebkitBackdropFilter: `blur(${px(block.blur)})`,
                }
              : {}),
          }}
        />
      );
    case 'button': {
      const locked =
        !ctx.edit &&
        ((block.action.kind !== 'link' && !ctx.canLeave) ||
          (block.enabledWhen === 'picks' && !ctx.picksCorrect) ||
          (block.enabledWhen === 'visited' && !ctx.linksDone) ||
          (block.enabledWhen === 'condition' && !ctx.passes(block.enabledIf ?? [])));
      return (
        <div className="cp-btnrow">
          <button
            type="button"
            className={`cp-btn cp-btn-${block.style}`}
            style={{
              ...(block.fill
                ? block.style === 'solid'
                  ? { background: block.fill, borderColor: block.fill }
                  : { borderColor: block.fill, color: block.fill }
                : {}),
              ...(block.style === 'solid' && block.gradient
                ? {
                    ...paintCss(undefined, block.gradient),
                    borderColor: 'transparent',
                  }
                : {}),
              ...shadowCss(block.shadow, 'box'),
              ...radiusCss(block.radius, block.corners),
              ...ctx.textStyle(block.textStyle),
            }}
            disabled={locked}
            title={locked ? 'Finish this page to continue' : undefined}
            onClick={() => !ctx.edit && ctx.act(block.action, block)}
          >
            {ctx.merge(block.label, false)}
          </button>
        </div>
      );
    }
    case 'audio':
      return <AudioView block={block} ctx={ctx} />;
    case 'animation':
      return <AnimationView block={block} />;
    case 'popup':
      return <PopupTrigger block={block} ctx={ctx} />;
    case 'accordion':
      return <AccordionView block={block} ctx={ctx} />;
    case 'tabs':
      return <TabsView block={block} ctx={ctx} />;
    case 'flip':
      return <FlipView block={block} ctx={ctx} />;
    case 'reveal':
      return <RevealView block={block} ctx={ctx} />;
    case 'hotspots':
      return <HotspotView block={block} ctx={ctx} />;
    case 'pathway':
      return <PathwayView block={block} ctx={ctx} />;
    case 'check':
      return <CheckView block={block} ctx={ctx} />;
    case 'drag':
      return <DragView block={block} ctx={ctx} />;
    case 'match':
      return <MatchView block={block} ctx={ctx} />;
    case 'blank':
      return <BlankView block={block} ctx={ctx} />;
    case 'slider':
      return <SliderView block={block} ctx={ctx} />;
    case 'written':
      return <WrittenView block={block} ctx={ctx} />;
    case 'likert':
      return <LikertView block={block} ctx={ctx} />;
    case 'results':
      return <ResultsView block={block} ctx={ctx} />;
  }
}
