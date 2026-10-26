import type { CSSProperties } from 'react';
import type { Block, Page } from './doc';

export const OUT_MS = 350;

export function animClass(b: Block, leaving: boolean, hidden: boolean): string {
  const a = b.anim;
  return [
    hidden && 'cp-cue-hidden',
    !leaving && a && a.in !== 'none' && `cp-in cp-in-${a.in}`,
    leaving && a && a.out !== 'none' && `cp-out cp-out-${a.out}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export const animStyle = (b: Block): CSSProperties =>
  b.anim && b.anim.delay > 0 ? { animationDelay: `${b.anim.delay}s` } : {};

export const hasExit = (page: Page) => page.blocks.some((b) => b.anim && b.anim.out !== 'none');
