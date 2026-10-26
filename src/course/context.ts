import type { Block, ButtonAction, Condition } from './doc';
import type { Answer } from './scorm';

export interface ReviewItem {
  id: string;
  prompt: string;
  correct: boolean;
}

export interface ResultsData {
  score: number | null;
  passMark: number | null;
  passed: boolean;
  review: ReviewItem[];
}

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
  openPopup(blockId: string): void;
  audioProgress(blockId: string, seconds: number): void;
  results(): ResultsData;
  retry(): void;
  mediaEnded(blockId: string): void;
  setVar(varId: string, value: string): void;
  passes(conditions: Condition[]): boolean;
  merge(text: string, html: boolean): string;
  clickable: Set<string>;
  canLeave: boolean;
}
