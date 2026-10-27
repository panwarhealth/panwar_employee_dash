import {
  newBlock,
  uid,
  type Block,
  type BlockType,
  type CourseDoc,
  type Layout,
  type Page,
  type Trigger,
  type Variable,
} from '@/course/doc';
import { layoutsFor } from '@/course/canvasLayout';
import * as ops from '@/course/edit';
import { BLOCKS, blockLabel } from './blockMeta';

export interface ToolOutcome {
  doc: CourseDoc;
  result: string;
  error?: boolean;
  activity?: string;
}

export interface ToolContext {
  importMedia: (url: string) => Promise<string>;
}

const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
});

export const ASSISTANT_TOOLS = [
  {
    name: 'get_page',
    description: 'Read the full JSON of one page.',
    input_schema: obj({ page_id: { type: 'string' } }, ['page_id']),
  },
  {
    name: 'put_page',
    description:
      'Create a page, or replace an existing page with the same id. Send the whole page: id, title, kind, blocks, triggers and optional pick and transition. Missing block fields fall back to the editor defaults. New pages go after after_page_id, or at the end when it is left out.',
    input_schema: obj(
      {
        page: { type: 'object', description: 'A Page as defined in the schema.' },
        after_page_id: { type: 'string' },
      },
      ['page'],
    ),
  },
  {
    name: 'delete_page',
    description: 'Delete a page.',
    input_schema: obj({ page_id: { type: 'string' } }, ['page_id']),
  },
  {
    name: 'move_page',
    description:
      'Move a page so it comes straight after another page, or first when after_page_id is "".',
    input_schema: obj({ page_id: { type: 'string' }, after_page_id: { type: 'string' } }, [
      'page_id',
      'after_page_id',
    ]),
  },
  {
    name: 'update_course',
    description:
      'Change course settings. Only the fields you send change. variables replaces the whole variable list.',
    input_schema: obj(
      {
        title: { type: 'string' },
        pass_mark: { type: ['number', 'null'] },
        accent: { type: 'string', description: 'Hex colour' },
        nav_bar: { type: 'boolean', description: 'Show the Back/Continue bar on every page' },
        variables: { type: 'array', items: { type: 'object' } },
      },
      [],
    ),
  },
  {
    name: 'import_media',
    description:
      'Download a file (image, mp4, mp3, captions, Lottie json, font) from a public URL into the course and get back the URL to use in blocks. Fails for links to web pages.',
    input_schema: obj({ url: { type: 'string' } }, ['url']),
  },
];

const BLOCK_TYPES = new Set<string>(BLOCKS.map((b) => b.type));

function fillIds(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rec = item as Record<string, unknown>;
        if (typeof rec.id !== 'string' || !rec.id) rec.id = uid();
      }
      fillIds(item);
    }
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) fillIds(v);
  }
}

function toPage(raw: Record<string, unknown>): Page | string {
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks: Block[] = [];
  for (const b of rawBlocks as Record<string, unknown>[]) {
    if (!BLOCK_TYPES.has(String(b?.type)))
      return `Unknown block type "${String(b?.type)}". Use one of: ${[...BLOCK_TYPES].join(', ')}.`;
    blocks.push({ ...newBlock(b.type as BlockType), ...b } as Block);
  }
  const page = {
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    title: typeof raw.title === 'string' ? raw.title : 'Untitled',
    kind: raw.kind === 'canvas' ? 'canvas' : 'flow',
    blocks,
    triggers: Array.isArray(raw.triggers)
      ? (raw.triggers as Trigger[]).map((t) => ({ ...t, conditions: t.conditions ?? [] }))
      : [],
  } as Page;
  fillIds(page.blocks);
  fillIds(page.triggers);
  return page;
}

function pageWarnings(doc: CourseDoc, page: Page): string[] {
  const warnings: string[] = [];
  const blockIds = new Set(page.blocks.map((b) => b.id));
  const pageIds = new Set(doc.pages.map((p) => p.id));
  const varIds = new Set(doc.variables.map((v) => v.id));
  const needBlock = (id: string, where: string) =>
    !blockIds.has(id) &&
    warnings.push(`${where} refers to block "${id}", which isn't on this page.`);
  const needPage = (id: string, where: string) =>
    id &&
    !pageIds.has(id) &&
    warnings.push(
      `${where} goes to page "${id}", which doesn't exist yet. Create it or fix the id.`,
    );
  const needVar = (id: string, where: string) =>
    !varIds.has(id) && warnings.push(`${where} uses variable "${id}", which doesn't exist.`);

  for (const t of page.triggers) {
    const where = `Trigger ${t.id}`;
    if (t.when.kind === 'click' || t.when.kind === 'mediaEnd') needBlock(t.when.blockId, where);
    if (t.when.kind === 'varChange') needVar(t.when.varId, where);
    const a = t.action;
    if (a.kind === 'popup' || a.kind === 'show' || a.kind === 'hide') needBlock(a.blockId, where);
    if (a.kind === 'page') needPage(a.pageId, where);
    if (a.kind === 'set') needVar(a.varId, where);
    for (const c of t.conditions) needVar(c.varId, where);
  }
  for (const b of page.blocks) {
    if (b.type === 'button' && b.action.kind === 'page')
      needPage(b.action.pageId, `Button ${b.id}`);
    if (b.type === 'pathway')
      for (const c of b.choices) needPage(c.pageId, `Pathway choice "${c.label}"`);
    if (b.type === 'audio') for (const c of b.cues) needBlock(c.blockId, `Audio cue ${c.id}`);
  }
  if (page.kind === 'canvas')
    for (const layout of layoutsFor(doc.screens) as Layout[])
      for (const b of page.blocks)
        if (!b.frames?.[layout])
          warnings.push(`Canvas block ${b.id} has no ${layout} frame, so it gets a default spot.`);
  return warnings;
}

export function courseOutline(doc: CourseDoc): string {
  return JSON.stringify({
    title: doc.title,
    screens: doc.screens,
    passMark: doc.passMark,
    navBar: !!doc.navBar,
    variables: doc.variables,
    pages: doc.pages.map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind,
      blocks: p.blocks.map((b) => `${b.id} ${b.type}: ${blockLabel(b).slice(0, 60)}`),
    })),
  });
}

export async function runTool(
  doc: CourseDoc,
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const fail = (result: string): ToolOutcome => ({ doc, result, error: true });
  const pageIdOf = (key: string) => String(input[key] ?? '');

  switch (name) {
    case 'get_page': {
      const page = doc.pages.find((p) => p.id === pageIdOf('page_id'));
      return page ? { doc, result: JSON.stringify(page) } : fail('No page with that id.');
    }
    case 'put_page': {
      if (!input.page || typeof input.page !== 'object') return fail('page is required.');
      const page = toPage(input.page as Record<string, unknown>);
      if (typeof page === 'string') return fail(page);
      const elsewhere = new Map(
        doc.pages
          .filter((p) => p.id !== page.id)
          .flatMap((p) => p.blocks.map((b) => [b.id, p.title] as const)),
      );
      const clash = page.blocks.find((b) => elsewhere.has(b.id));
      if (clash)
        return fail(
          `Block id "${clash.id}" is already used on page "${elsewhere.get(clash.id)}". Ids must be unique in the course.`,
        );
      const exists = doc.pages.some((p) => p.id === page.id);
      const after = pageIdOf('after_page_id');
      const next = exists
        ? ops.updateCourse(
            doc,
            (d) => (d.pages = d.pages.map((p) => (p.id === page.id ? page : p))),
          )
        : after && doc.pages.some((p) => p.id === after)
          ? ops.insertPage(doc, after, page)
          : ops.updateCourse(doc, (d) => d.pages.push(page));
      const warnings = pageWarnings(next, page);
      return {
        doc: next,
        result: JSON.stringify({ ok: true, page_id: page.id, warnings }),
        activity: `${exists ? 'Updated' : 'Built'} page: ${page.title}`,
      };
    }
    case 'delete_page': {
      const page = doc.pages.find((p) => p.id === pageIdOf('page_id'));
      if (!page) return fail('No page with that id.');
      if (doc.pages.length === 1)
        return fail("A course needs at least one page, so this one can't go.");
      return {
        doc: ops.removePage(doc, page.id),
        result: 'ok',
        activity: `Deleted page: ${page.title}`,
      };
    }
    case 'move_page': {
      const from = doc.pages.findIndex((p) => p.id === pageIdOf('page_id'));
      if (from < 0) return fail('No page with that id.');
      const after = pageIdOf('after_page_id');
      const afterIndex = after ? doc.pages.findIndex((p) => p.id === after) : -1;
      if (after && afterIndex < 0) return fail('No page with after_page_id.');
      const to = afterIndex < from ? afterIndex + 1 : afterIndex;
      return {
        doc: ops.movePage(doc, from, to),
        result: 'ok',
        activity: `Moved page: ${doc.pages[from].title}`,
      };
    }
    case 'update_course': {
      const next = ops.updateCourse(doc, (d) => {
        if (typeof input.title === 'string') d.title = input.title;
        if (typeof input.pass_mark === 'number' || input.pass_mark === null)
          d.passMark = input.pass_mark as number | null;
        if (typeof input.accent === 'string') d.accent = input.accent;
        if (typeof input.nav_bar === 'boolean') d.navBar = input.nav_bar;
        if (Array.isArray(input.variables)) {
          d.variables = input.variables as Variable[];
          fillIds(d.variables);
        }
      });
      return { doc: next, result: 'ok', activity: 'Updated course settings' };
    }
    case 'import_media': {
      try {
        const url = await ctx.importMedia(String(input.url ?? ''));
        return { doc, result: JSON.stringify({ url }), activity: 'Downloaded a media file' };
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Download failed.');
      }
    }
    default:
      return fail(`Unknown tool ${name}.`);
  }
}
