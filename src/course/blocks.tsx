import type { Block } from './doc';
import type { BlockContext } from './context';
import { sanitizeHtml } from './sanitize';
import { embedUrl } from './util';
import { AnimationView, AudioView } from './media';
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
  WrittenView,
} from './questions';

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
    case 'scroll':
      return (
        <div
          className="cp-text cp-scroll"
          style={{ maxHeight: block.height }}
          tabIndex={0}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
        />
      );
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
    case 'audio':
      return <AudioView block={block} ctx={ctx} />;
    case 'animation':
      return <AnimationView block={block} />;
    case 'popup':
      return <PopupTrigger block={block} ctx={ctx} />;
    case 'accordion':
      return <AccordionView block={block} />;
    case 'tabs':
      return <TabsView block={block} />;
    case 'flip':
      return <FlipView block={block} />;
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
    case 'written':
      return <WrittenView block={block} ctx={ctx} />;
    case 'likert':
      return <LikertView block={block} ctx={ctx} />;
    case 'results':
      return <ResultsView block={block} ctx={ctx} />;
  }
}
