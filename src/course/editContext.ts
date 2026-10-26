import type { BlockContext } from './context';
import type { CourseDoc } from './doc';
import { textStyleCss } from './typography';

export const editContext = (doc: CourseDoc): BlockContext => ({
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
  mediaEnded: () => {},
  setVar: () => {},
  passes: () => true,
  merge: (text) => text,
  clickable: new Set(),
  canLeave: true,
  textStyle: (style) => textStyleCss(style, doc),
});
