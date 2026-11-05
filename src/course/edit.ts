import {
  moveItem,
  uid,
  type Block,
  type CourseDoc,
  type Frame,
  type Layout,
  type Page,
} from './doc';
import { frameFor, lookFor, MERGED_LOOKS } from './canvasLayout';
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

const LOOK_KEYS = new Set([
  'textStyle',
  'align',
  'valign',
  'padding',
  'fill',
  'gradient',
  'shadow',
  'radius',
  'corners',
  'border',
  'level',
  'size',
  'style',
  'look',
  'crop',
  'stretch',
]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diff(shown: Record<string, unknown>, base: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(shown)]))
    if (!same(shown[key], base[key])) out[key] = shown[key] ?? null;
  return out;
}

export function changeLook(b: Block, layout: Layout, base: Layout, fn: (b: Block) => void) {
  if (layout === base) return fn(b);
  const shown = structuredClone(lookFor(b, layout)) as unknown as Record<string, unknown>;
  fn(shown as unknown as Block);
  const block = b as unknown as Record<string, unknown>;
  const own: Record<string, unknown> = { ...b.looks?.[layout] };
  for (const key of new Set([...Object.keys(block), ...Object.keys(shown)])) {
    if (key === 'looks' || key === 'frames') continue;
    if (LOOK_KEYS.has(key)) {
      const objects = MERGED_LOOKS.has(key) && shown[key] && block[key];
      const change = objects
        ? diff(shown[key] as Record<string, unknown>, block[key] as Record<string, unknown>)
        : shown[key];
      if (same(shown[key], block[key]) || (objects && !Object.keys(change as object).length))
        delete own[key];
      else own[key] = change ?? null;
    } else if (shown[key] === undefined) delete block[key];
    else if (!same(shown[key], block[key])) block[key] = shown[key];
  }
  const looks = { ...b.looks };
  if (Object.keys(own).length) looks[layout] = own;
  else delete looks[layout];
  if (Object.keys(looks).length) b.looks = looks;
  else delete b.looks;
}

export const removeBlock = (doc: CourseDoc, pageId: string, blockId: string) =>
  updatePage(doc, pageId, (p) => (p.blocks = p.blocks.filter((b) => b.id !== blockId)));

export const moveBlock = (doc: CourseDoc, pageId: string, from: number, to: number) =>
  updatePage(doc, pageId, (p) => moveItem(p.blocks, from, to));

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

export const setFrames = (
  doc: CourseDoc,
  pageId: string,
  layout: Layout,
  frames: Record<string, Frame>,
) =>
  updatePage(doc, pageId, (p) =>
    p.blocks.forEach((b) => {
      if (frames[b.id]) b.frames = { ...b.frames, [layout]: roundFrame(frames[b.id]) };
    }),
  );

export const removeBlocks = (doc: CourseDoc, pageId: string, ids: string[]) =>
  updatePage(doc, pageId, (p) => {
    p.blocks = p.blocks.filter((b) => !ids.includes(b.id));
    p.groups = (p.groups ?? [])
      .map((g) => ({ ...g, members: g.members.filter((m) => !ids.includes(m)) }))
      .filter((g) => g.members.length > 1);
    if (!p.groups.length) delete p.groups;
  });

export const groupBlocks = (doc: CourseDoc, pageId: string, ids: string[], groupId: string) =>
  updatePage(doc, pageId, (p) => {
    const merged = (p.groups ?? []).filter((g) => g.members.some((m) => ids.includes(m)));
    const wanted = new Set([...ids, ...merged.flatMap((g) => g.members)]);
    const others = (p.groups ?? []).filter((g) => !merged.includes(g));
    const names = new Set(others.map((g) => g.name));
    let n = 1;
    while (names.has(`Group ${n}`)) n++;
    p.groups = [
      ...others,
      {
        id: groupId,
        name: `Group ${n}`,
        members: p.blocks.filter((b) => wanted.has(b.id)).map((b) => b.id),
        ...(merged[0]?.interact ? { interact: merged[0].interact } : {}),
      },
    ];
  });

export const ungroup = (doc: CourseDoc, pageId: string, groupId: string) =>
  updatePage(doc, pageId, (p) => {
    p.groups = (p.groups ?? []).filter((g) => g.id !== groupId);
    if (!p.groups.length) delete p.groups;
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
