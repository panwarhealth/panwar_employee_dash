import type { BlockContext } from './blocks';

export const EDIT_CTX: BlockContext = {
  edit: true,
  answers: {},
  answer: () => {},
  next: () => {},
  act: () => {},
  picked: [],
  clicked: [],
  picksCorrect: false,
  click: () => {},
};
