import { hasPicks, pickIds, type Block, type Page } from './doc';

export interface PickStatus {
  needed: number;
  done: boolean;
  correct: boolean;
}

const correctIds = (page: Page) =>
  pickIds(page).filter((id) => page.blocks.find((b) => b.id === id)?.interact?.correct);

export function pickStatus(page: Page, picks: string[]): PickStatus {
  const right = correctIds(page);
  const needed = page.pick?.needed ?? right.length;
  const done = needed > 0 && picks.length >= needed;
  return { needed, done, correct: done && picks.every((id) => right.includes(id)) };
}

export const pickBlocks = (page: Page) => hasPicks(page) && (page.pick?.required ?? true);

export function togglePick(page: Page, picks: string[], block: Block): string[] {
  if (picks.includes(block.id)) return picks.filter((id) => id !== block.id);
  if (pickStatus(page, picks).done) return picks;
  return [...picks, block.id];
}
