import type { BlockContext } from './context';

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
  openPopup: () => {},
  audioProgress: () => {},
  results: () => ({ score: 80, passMark: null, passed: true, review: [] }),
  retry: () => {},
};
