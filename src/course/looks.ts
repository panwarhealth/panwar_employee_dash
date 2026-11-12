import type { CSSProperties } from 'react';
import type { QuestionLook, TextStyle } from './doc';
import type { BlockContext } from './context';
import { px } from './typography';

export const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

export function lookVars(look: QuestionLook = {}): CSSProperties {
  const v: Record<string, string> = {};
  if (look.colour) v['--cp-accent'] = look.colour;
  if (look.textColour) {
    v['--cp-ink'] = look.textColour;
    v['--cp-ink-2'] = `color-mix(in srgb, ${look.textColour} 65%, transparent)`;
    v.color = look.textColour;
  }
  if (look.size) v.fontSize = `${look.size / 16}em`;
  if (look.radius !== undefined) v['--cp-r'] = px(look.radius);
  if (look.fill) v['--cp-box-bg'] = look.fill;
  if (look.boxPadding) v['--cp-box-pad'] = look.boxPadding.map(px).join(' ');
  if (look.answerAlign) {
    v['--cp-opt-align'] = look.answerAlign;
    v['--cp-opt-justify'] = JUSTIFY[look.answerAlign];
  }
  if (look.answerInside) {
    v['--cp-opt-inner-align'] = look.answerInside;
    v['--cp-opt-inner'] = JUSTIFY[look.answerInside];
  }
  if (look.questionGap !== undefined) v['--cp-q-gap'] = px(look.questionGap);
  if (look.answerGap !== undefined) v['--cp-opt-gap'] = px(look.answerGap);
  if (look.answerRowGap !== undefined) v['--cp-opt-rowgap'] = px(look.answerRowGap);
  if (look.answerPadding) v['--cp-opt-pad'] = look.answerPadding.map(px).join(' ');
  if (look.answerFill) v['--cp-opt-bg'] = look.answerFill;
  if (look.answerBorder) v['--cp-opt-line'] = look.answerBorder;
  const ink = look.answerStyle?.color ?? look.answerText;
  if (ink) v['--cp-opt-ink'] = ink;
  return v as CSSProperties;
}

export function partCss(ctx: BlockContext, style: TextStyle | undefined): CSSProperties {
  if (!style) return {};
  return { ...ctx.textStyle(style), fontSize: style.size ? px(style.size) : undefined };
}

export function itemCss(ctx: BlockContext, style: TextStyle | undefined): CSSProperties {
  const css = partCss(ctx, style);
  delete css.color;
  return css;
}

export const boxClass = (look: QuestionLook = {}) =>
  `cp-looked${look.card ? ' cp-boxed' : ''}`;
