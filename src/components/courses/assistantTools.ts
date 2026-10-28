import {
  isQuestion,
  newBlock,
  uid,
  type Block,
  type BlockType,
  type ButtonAction,
  type ButtonBlock,
  type CourseDoc,
  type Frame,
  type Layout,
  type Page,
  type Trigger,
  type Variable,
} from '@/course/doc';
import { layoutsFor } from '@/course/canvasLayout';
import * as ops from '@/course/edit';
import { BLOCKS, blockLabel } from './blockMeta';
import { pageFitWarnings } from './pageFit';

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
    name: 'update_blocks',
    description:
      'Change fields on existing blocks. Only the fields you send change; everything else, including colours, fills and positions, stays as it is. frames merge per layout, so {"frames": {"phone": {"y": 40}}} moves only the phone y. Send null to clear a field. A block\'s type can\'t change: use make_button, or add_blocks with in_place_of.',
    input_schema: obj(
      {
        page_id: { type: 'string' },
        changes: {
          type: 'array',
          items: { type: 'object', description: 'id plus the fields to change' },
        },
      },
      ['page_id', 'changes'],
    ),
  },
  {
    name: 'add_blocks',
    description:
      "Add blocks to a page. Give a block in_place_of (a list of block ids) to put it exactly where those blocks are in every layout and remove them, for example a check question replacing the slide's question and answer text boxes. Otherwise give it frames for every layout; it goes on top, or straight after after_block_id.",
    input_schema: obj(
      {
        page_id: { type: 'string' },
        blocks: { type: 'array', items: { type: 'object' } },
        after_block_id: { type: 'string' },
      },
      ['page_id', 'blocks'],
    ),
  },
  {
    name: 'remove_blocks',
    description: 'Remove blocks from a page.',
    input_schema: obj(
      { page_id: { type: 'string' }, block_ids: { type: 'array', items: { type: 'string' } } },
      ['page_id', 'block_ids'],
    ),
  },
  {
    name: 'make_button',
    description:
      'Turn a text or heading block, such as a slide\'s Continue or Next shape, into a button that keeps its look and position. action is {"kind":"next"}, {"kind":"page","pageId":...} or {"kind":"link","url":...}.',
    input_schema: obj(
      {
        page_id: { type: 'string' },
        block_id: { type: 'string' },
        action: { type: 'object' },
        label: { type: 'string' },
      },
      ['page_id', 'block_id', 'action'],
    ),
  },
  {
    name: 'update_page',
    description:
      "Change a page's title, triggers, pick rule or transition. triggers replaces the whole trigger list.",
    input_schema: obj(
      {
        page_id: { type: 'string' },
        title: { type: 'string' },
        triggers: { type: 'array', items: { type: 'object' } },
        pick: { type: ['object', 'null'] },
        transition: { type: 'string' },
      },
      ['page_id'],
    ),
  },
  {
    name: 'add_note',
    description:
      'Leave a note for the designer about something they must check, decide or finish by hand, on a page or on one object on it (block_id). It shows as an amber tag on that object in the editor until they mark it fixed. Use it for every to-do instead of listing them in your reply.',
    input_schema: obj(
      { page_id: { type: 'string' }, block_id: { type: 'string' }, text: { type: 'string' } },
      ['page_id', 'text'],
    ),
  },
  {
    name: 'add_page',
    description:
      'Create a new page, such as a results page. Send the whole page: id, title, kind "canvas", blocks with frames for every layout, and triggers. It goes after after_page_id, or at the end.',
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

function toBlock(raw: Record<string, unknown>): Block | string {
  if (!BLOCK_TYPES.has(String(raw?.type)))
    return `Unknown block type "${String(raw?.type)}". Use one of: ${[...BLOCK_TYPES].join(', ')}.`;
  const block = { ...newBlock(raw.type as BlockType), ...raw } as Block;
  fillIds([block]);
  return block;
}

function toPage(raw: Record<string, unknown>): Page | string {
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks: Block[] = [];
  for (const b of rawBlocks as Record<string, unknown>[]) {
    const block = toBlock(b);
    if (typeof block === 'string') return block;
    blocks.push(block);
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
    if (b.type === 'drag' && b.style === 'targets' && !b.src)
      warnings.push(
        `Drag ${b.id} has drop targets but no picture, so the targets show as a plain row and their positions are ignored.`,
      );
  }
  if (page.kind === 'canvas')
    for (const layout of layoutsFor(doc.screens) as Layout[]) {
      for (const b of page.blocks)
        if (!b.frames?.[layout])
          warnings.push(`Canvas block ${b.id} has no ${layout} frame, so it gets a default spot.`);
      for (const q of page.blocks.filter(isQuestion)) {
        const qf = q.frames?.[layout];
        if (!qf) continue;
        for (const b of page.blocks.slice(page.blocks.indexOf(q) + 1)) {
          const f = b.frames?.[layout];
          if (!f || isQuestion(b)) continue;
          const w = Math.min(f.x + f.w, qf.x + qf.w) - Math.max(f.x, qf.x);
          const h = Math.min(f.y + f.h, qf.y + qf.h) - Math.max(f.y, qf.y);
          if (w > 0 && h > 0 && w * h > 0.2 * Math.min(f.w * f.h, qf.w * qf.h))
            warnings.push(
              `${b.type} ${b.id} covers question ${q.id} in the ${layout} layout. Questions draw their own box, so anything placed over one hides its answers.`,
            );
        }
      }
    }
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

function takenIds(doc: CourseDoc): Set<string> {
  return new Set(doc.pages.flatMap((p) => p.blocks.map((b) => b.id)));
}

function unionFrames(blocks: Block[]): Block['frames'] {
  const frames: NonNullable<Block['frames']> = {};
  const layouts = new Set(blocks.flatMap((b) => Object.keys(b.frames ?? {}) as Layout[]));
  for (const layout of layouts) {
    const all = blocks.map((b) => b.frames?.[layout]).filter((f): f is Frame => !!f);
    const x = Math.min(...all.map((f) => f.x));
    const y = Math.min(...all.map((f) => f.y));
    frames[layout] = {
      x,
      y,
      w: Math.round((Math.max(...all.map((f) => f.x + f.w)) - x) * 10) / 10,
      h: Math.round((Math.max(...all.map((f) => f.y + f.h)) - y) * 10) / 10,
      r: 0,
      ...(all[0].a ? { a: all[0].a } : {}),
    };
  }
  return frames;
}

async function checked(
  next: CourseDoc,
  pageId: string,
  touched: Set<string>,
  activity: string,
): Promise<ToolOutcome> {
  const page = next.pages.find((p) => p.id === pageId)!;
  const fit = touched.size ? await pageFitWarnings(next, page) : [];
  const warnings = [
    ...pageWarnings(next, page),
    ...fit.filter((w) => [...touched].some((id) => w.includes(` ${id} `))),
  ];
  return {
    doc: next,
    result: JSON.stringify({
      ok: true,
      warnings,
      ...(warnings.length ? { next: 'Fix these warnings before moving on.' } : {}),
    }),
    activity,
  };
}

export async function runTool(
  doc: CourseDoc,
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const fail = (result: string): ToolOutcome => ({ doc, result, error: true });
  const pageIdOf = (key: string) => String(input[key] ?? '');
  const pageOf = (key: string) => doc.pages.find((p) => p.id === pageIdOf(key));

  switch (name) {
    case 'get_page': {
      const page = doc.pages.find((p) => p.id === pageIdOf('page_id'));
      return page ? { doc, result: JSON.stringify(page) } : fail('No page with that id.');
    }
    case 'add_page': {
      if (!input.page || typeof input.page !== 'object') return fail('page is required.');
      const page = toPage(input.page as Record<string, unknown>);
      if (typeof page === 'string') return fail(page);
      if (doc.pages.some((p) => p.id === page.id))
        return fail(`A page with id "${page.id}" already exists. Change it with the block tools.`);
      const clash = page.blocks.find((b) => takenIds(doc).has(b.id));
      if (clash)
        return fail(`Block id "${clash.id}" is already used. Ids must be unique in the course.`);
      const after = pageIdOf('after_page_id');
      const next =
        after && doc.pages.some((p) => p.id === after)
          ? ops.insertPage(doc, after, page)
          : ops.updateCourse(doc, (d) => d.pages.push(page));
      return checked(
        next,
        page.id,
        new Set(page.blocks.map((b) => b.id)),
        `Built page: ${page.title}`,
      );
    }
    case 'update_blocks': {
      const page = pageOf('page_id');
      if (!page) return fail('No page with that id.');
      const changes = Array.isArray(input.changes)
        ? (input.changes as Record<string, unknown>[])
        : [];
      const missing = changes.find((c) => !page.blocks.some((b) => b.id === c.id));
      if (missing) return fail(`No block "${String(missing.id)}" on this page.`);
      const next = ops.updatePage(doc, page.id, (p) => {
        for (const change of changes) {
          const block = p.blocks.find((b) => b.id === change.id) as unknown as Record<
            string,
            unknown
          >;
          for (const [key, value] of Object.entries(change)) {
            if (key === 'id' || key === 'type') continue;
            if (key === 'frames' && value && typeof value === 'object') {
              const frames = { ...(block.frames as Record<string, object> | undefined) };
              for (const [layout, f] of Object.entries(value as Record<string, object>))
                frames[layout] = { ...frames[layout], ...f };
              block.frames = frames;
            } else if (value === null) delete block[key];
            else block[key] = value;
          }
          fillIds([block]);
        }
      });
      return checked(
        next,
        page.id,
        new Set(changes.map((c) => String(c.id))),
        `Updated ${page.title}`,
      );
    }
    case 'add_blocks': {
      const page = pageOf('page_id');
      if (!page) return fail('No page with that id.');
      const raws = Array.isArray(input.blocks) ? (input.blocks as Record<string, unknown>[]) : [];
      const taken = takenIds(doc);
      const touched = new Set<string>();
      let next = doc;
      let after = typeof input.after_block_id === 'string' ? input.after_block_id : null;
      for (const raw of raws) {
        const { in_place_of: inPlaceOf, ...rest } = raw;
        const block = toBlock(rest);
        if (typeof block === 'string') return fail(block);
        if (taken.has(block.id))
          return fail(`Block id "${block.id}" is already used. Ids must be unique in the course.`);
        taken.add(block.id);
        touched.add(block.id);
        const current = next.pages.find((p) => p.id === page.id)!;
        if (Array.isArray(inPlaceOf) && inPlaceOf.length) {
          const replaced = current.blocks.filter((b) => inPlaceOf.includes(b.id));
          if (replaced.length !== inPlaceOf.length)
            return fail('in_place_of names blocks that are not on this page.');
          block.frames = unionFrames(replaced);
          next = ops.updatePage(next, page.id, (p) => {
            const at = p.blocks.findIndex((b) => inPlaceOf.includes(b.id));
            p.blocks = p.blocks.filter((b) => !inPlaceOf.includes(b.id));
            p.blocks.splice(at, 0, block);
          });
        } else {
          next = ops.insertBlock(next, page.id, after, block);
          after = block.id;
        }
      }
      return checked(next, page.id, touched, `Added to ${page.title}`);
    }
    case 'remove_blocks': {
      const page = pageOf('page_id');
      if (!page) return fail('No page with that id.');
      const ids = Array.isArray(input.block_ids) ? (input.block_ids as string[]) : [];
      const next = ops.updatePage(doc, page.id, (p) => {
        p.blocks = p.blocks.filter((b) => !ids.includes(b.id));
      });
      return checked(next, page.id, new Set(), `Removed objects from ${page.title}`);
    }
    case 'make_button': {
      const page = pageOf('page_id');
      if (!page) return fail('No page with that id.');
      const old = page.blocks.find((b) => b.id === input.block_id);
      if (!old || (old.type !== 'text' && old.type !== 'heading'))
        return fail('block_id must be a text or heading block on this page.');
      const label =
        typeof input.label === 'string'
          ? input.label
          : old.type === 'heading'
            ? old.text
            : old.html
                .replace(/<br\s*\/?>|<\/p>/g, ' ')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim();
      const button: ButtonBlock = {
        id: old.id,
        type: 'button',
        label,
        action: input.action as ButtonAction,
        style: 'solid',
        fill: old.fill,
        radius: old.radius,
        corners: old.corners,
        textStyle: old.textStyle,
        frames: old.frames,
        ...(old.anim ? { anim: old.anim } : {}),
        ...(old.startHidden ? { startHidden: true } : {}),
      };
      const next = ops.updatePage(doc, page.id, (p) => {
        p.blocks = p.blocks.map((b) => (b.id === old.id ? button : b));
      });
      return checked(next, page.id, new Set([old.id]), `Made a button on ${page.title}`);
    }
    case 'add_note': {
      const page = pageOf('page_id');
      if (!page) return fail('No page with that id.');
      const blockId =
        typeof input.block_id === 'string' && input.block_id ? input.block_id : undefined;
      if (blockId && !page.blocks.some((b) => b.id === blockId))
        return fail(`No block "${blockId}" on this page.`);
      const text = String(input.text ?? '').trim();
      if (!text) return fail('text is required.');
      return {
        doc: ops.updatePage(doc, page.id, (p) => {
          p.notes = [...(p.notes ?? []), { id: uid(), ...(blockId ? { blockId } : {}), text }];
        }),
        result: 'ok',
        activity: `Left a note on ${page.title}`,
      };
    }
    case 'update_page': {
      const page = pageOf('page_id');
      if (!page) return fail('No page with that id.');
      const next = ops.updatePage(doc, page.id, (p) => {
        if (typeof input.title === 'string') p.title = input.title;
        if (Array.isArray(input.triggers)) {
          p.triggers = (input.triggers as Trigger[]).map((t) => ({
            ...t,
            conditions: t.conditions ?? [],
          }));
          fillIds(p.triggers);
        }
        if (input.pick === null) delete p.pick;
        else if (input.pick && typeof input.pick === 'object') p.pick = input.pick as Page['pick'];
        if (typeof input.transition === 'string')
          p.transition = input.transition as Page['transition'];
      });
      return checked(next, page.id, new Set(), `Updated ${page.title}`);
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
