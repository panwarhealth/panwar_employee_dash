import {
  moveItem,
  uid,
  type Block,
  type CourseDoc,
  type Frame,
  type Layout,
  type Page,
} from './doc';
import { frameFor } from './canvasLayout';
import { round1 } from './geometry';

function draft(doc: CourseDoc, fn: (d: CourseDoc) => void): CourseDoc {
  const next = structuredClone(doc);
  fn(next);
  return next;
}

const pageAt = (d: CourseDoc, pageId: string) => d.pages.findIndex((p) => p.id === pageId);

export const updateCourse = (doc: CourseDoc, fn: (d: CourseDoc) => void) => draft(doc, fn);

export const insertPage = (doc: CourseDoc, afterId: string, page: Page) =>
  draft(doc, (d) => d.pages.splice(pageAt(d, afterId) + 1, 0, page));

export function copyPage(page: Page): Page {
  const copy = structuredClone(page);
  copy.id = uid();
  copy.title = `${page.title} copy`;
  copy.blocks.forEach((b) => (b.id = uid()));
  return copy;
}

export const removePage = (doc: CourseDoc, pageId: string) =>
  draft(doc, (d) => (d.pages = d.pages.filter((p) => p.id !== pageId)));

export const movePage = (doc: CourseDoc, from: number, to: number) =>
  draft(doc, (d) => moveItem(d.pages, from, to));

export const updatePage = (doc: CourseDoc, pageId: string, fn: (p: Page) => void) =>
  draft(doc, (d) => fn(d.pages[pageAt(d, pageId)]));

export const insertBlock = (doc: CourseDoc, pageId: string, afterId: string | null, block: Block) =>
  updatePage(doc, pageId, (p) => {
    const at = afterId ? p.blocks.findIndex((b) => b.id === afterId) + 1 : p.blocks.length;
    p.blocks.splice(at, 0, block);
  });

export const copyBlock = (block: Block): Block => ({
  ...structuredClone(block),
  id: uid(),
});

export const updateBlock = (
  doc: CourseDoc,
  pageId: string,
  blockId: string,
  fn: (b: Block) => void,
) => updatePage(doc, pageId, (p) => fn(p.blocks.find((b) => b.id === blockId)!));

export const removeBlock = (doc: CourseDoc, pageId: string, blockId: string) =>
  updatePage(doc, pageId, (p) => (p.blocks = p.blocks.filter((b) => b.id !== blockId)));

export const moveBlock = (doc: CourseDoc, pageId: string, from: number, to: number) =>
  updatePage(doc, pageId, (p) => moveItem(p.blocks, from, to));

export const setPageKind = (doc: CourseDoc, pageId: string, kind: Page['kind']) =>
  updatePage(doc, pageId, (p) => (p.kind = kind));

export const setFrame = (
  doc: CourseDoc,
  pageId: string,
  blockId: string,
  layout: Layout,
  frame: Frame,
) =>
  updateBlock(doc, pageId, blockId, (b) => {
    b.frames = { ...b.frames, [layout]: roundFrame(frame) };
  });

export const copyLayout = (doc: CourseDoc, pageId: string, from: Layout, to: Layout) =>
  updatePage(doc, pageId, (p) =>
    p.blocks.forEach((b) => {
      b.frames = { ...b.frames, [to]: frameFor(p, b, from) };
    }),
  );

const roundFrame = (f: Frame): Frame => ({
  x: round1(f.x),
  y: round1(f.y),
  w: round1(f.w),
  h: round1(f.h),
  r: Math.round(f.r),
  ...(f.a && f.a !== 'auto' ? { a: f.a } : {}),
  ...(f.s && f.s !== 1 ? { s: f.s } : {}),
});
