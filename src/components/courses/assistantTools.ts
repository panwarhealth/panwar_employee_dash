import {
  newBlock,
  uid,
  type Block,
  type BlockType,
  type ButtonAction,
  type ButtonBlock,
  type CourseDoc,
  type Page,
  type Trigger,
  type Variable,
} from '@/course/doc';
import { blockText } from '@/course/text';
import * as ops from '@/course/edit';
import { BLOCKS, blockLabel } from './blockMeta';
import { checkedOutcome, type ToolOutcome } from './assistantChecks';
import { replacement } from './blockPlacement';

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
      'Create a new page, such as a results page. Send the whole page: id, title, blocks with desktop frames, and triggers. It goes after after_page_id, or at the end.',
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
    blocks,
    triggers: Array.isArray(raw.triggers)
      ? (raw.triggers as Trigger[]).map((t) => ({ ...t, conditions: t.conditions ?? [] }))
      : [],
  } as Page;
  fillIds(page.blocks);
  fillIds(page.triggers);
  return page;
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
      blocks: p.blocks.map((b) => `${b.id} ${b.type}: ${blockLabel(b).slice(0, 60)}`),
    })),
  });
}

type Input = Record<string, unknown>;
type Handler = (
  doc: CourseDoc,
  input: Input,
  ctx: ToolContext,
) => Promise<ToolOutcome> | ToolOutcome;

const fail = (doc: CourseDoc, result: string): ToolOutcome => ({ doc, result, error: true });

const pageOf = (doc: CourseDoc, input: Input, key = 'page_id') =>
  doc.pages.find((p) => p.id === String(input[key] ?? ''));

const takenIds = (doc: CourseDoc) => new Set(doc.pages.flatMap((p) => p.blocks.map((b) => b.id)));

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

function mergeBlockChanges(block: Record<string, unknown>, change: Input) {
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

const getPage: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  return page ? { doc, result: JSON.stringify(page) } : fail(doc, 'No page with that id.');
};

const addPage: Handler = (doc, input) => {
  if (!input.page || typeof input.page !== 'object') return fail(doc, 'page is required.');
  const page = toPage(input.page as Input);
  if (typeof page === 'string') return fail(doc, page);
  if (doc.pages.some((p) => p.id === page.id))
    return fail(doc, `A page with id "${page.id}" already exists. Change it with the block tools.`);
  const taken = takenIds(doc);
  const clash = page.blocks.find((b) => taken.has(b.id));
  if (clash)
    return fail(doc, `Block id "${clash.id}" is already used. Ids must be unique in the course.`);
  const after = pageOf(doc, input, 'after_page_id');
  const next = after
    ? ops.insertPage(doc, after.id, page)
    : ops.updateCourse(doc, (d) => d.pages.push(page));
  return checkedOutcome(
    next,
    page.id,
    new Set(page.blocks.map((b) => b.id)),
    `Built page: ${page.title}`,
  );
};

const updateBlocks: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
  const changes = list<Input>(input.changes);
  const missing = changes.find((c) => !page.blocks.some((b) => b.id === c.id));
  if (missing) return fail(doc, `No block "${String(missing.id)}" on this page.`);
  const next = ops.updatePage(doc, page.id, (p) => {
    for (const change of changes)
      mergeBlockChanges(p.blocks.find((b) => b.id === change.id) as unknown as Input, change);
  });
  return checkedOutcome(
    next,
    page.id,
    new Set(changes.map((c) => String(c.id))),
    `Updated ${page.title}`,
  );
};

const addBlocks: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
  const taken = takenIds(doc);
  const touched = new Set<string>();
  let next = doc;
  let after = typeof input.after_block_id === 'string' ? input.after_block_id : null;
  for (const raw of list<Input>(input.blocks)) {
    const { in_place_of: inPlaceOf, ...rest } = raw;
    const block = toBlock(rest);
    if (typeof block === 'string') return fail(doc, block);
    if (taken.has(block.id))
      return fail(doc, `Block id "${block.id}" is already used. Ids must be unique in the course.`);
    taken.add(block.id);
    touched.add(block.id);
    const current = next.pages.find((p) => p.id === page.id)!;
    const replacing = list<string>(inPlaceOf);
    if (replacing.length) {
      const named = current.blocks.filter((b) => replacing.includes(b.id));
      if (named.length !== replacing.length)
        return fail(doc, 'in_place_of names blocks that are not on this page.');
      const swap = replacement(current, named);
      block.frames = swap.frames;
      next = ops.updatePage(next, page.id, (p) => {
        const at = p.blocks.findIndex((b) => swap.ids.has(b.id));
        p.blocks = p.blocks.filter((b) => !swap.ids.has(b.id));
        p.blocks.splice(at, 0, block);
      });
    } else {
      if (block.frames?.desktop && !block.frames.phone)
        block.frames = { ...block.frames, phone: { ...block.frames.desktop } };
      next = ops.insertBlock(next, page.id, after, block);
      after = block.id;
    }
  }
  return checkedOutcome(next, page.id, touched, `Added to ${page.title}`);
};

const removeBlocks: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
  const ids = list<string>(input.block_ids);
  const next = ops.updatePage(doc, page.id, (p) => {
    p.blocks = p.blocks.filter((b) => !ids.includes(b.id));
  });
  return checkedOutcome(next, page.id, new Set(), `Removed objects from ${page.title}`);
};

const makeButton: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
  const old = page.blocks.find((b) => b.id === input.block_id);
  if (!old || (old.type !== 'text' && old.type !== 'heading'))
    return fail(doc, 'block_id must be a text or heading block on this page.');
  const button: ButtonBlock = {
    id: old.id,
    type: 'button',
    label:
      typeof input.label === 'string' ? input.label : blockText(old).replace(/\s+/g, ' ').trim(),
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
  return checkedOutcome(next, page.id, new Set([old.id]), `Made a button on ${page.title}`);
};

const addNote: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
  const blockId = typeof input.block_id === 'string' && input.block_id ? input.block_id : undefined;
  if (blockId && !page.blocks.some((b) => b.id === blockId))
    return fail(doc, `No block "${blockId}" on this page.`);
  const text = String(input.text ?? '').trim();
  if (!text) return fail(doc, 'text is required.');
  return {
    doc: ops.updatePage(doc, page.id, (p) => {
      p.notes = [...(p.notes ?? []), { id: uid(), ...(blockId ? { blockId } : {}), text }];
    }),
    result: 'ok',
    activity: `Left a note on ${page.title}`,
  };
};

const updatePage: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
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
    if (typeof input.transition === 'string') p.transition = input.transition as Page['transition'];
  });
  return checkedOutcome(next, page.id, new Set(), `Updated ${page.title}`);
};

const deletePage: Handler = (doc, input) => {
  const page = pageOf(doc, input);
  if (!page) return fail(doc, 'No page with that id.');
  if (doc.pages.length === 1)
    return fail(doc, "A course needs at least one page, so this one can't go.");
  return {
    doc: ops.removePage(doc, page.id),
    result: 'ok',
    activity: `Deleted page: ${page.title}`,
  };
};

const movePage: Handler = (doc, input) => {
  const from = doc.pages.findIndex((p) => p.id === String(input.page_id ?? ''));
  if (from < 0) return fail(doc, 'No page with that id.');
  const after = String(input.after_page_id ?? '');
  const afterIndex = after ? doc.pages.findIndex((p) => p.id === after) : -1;
  if (after && afterIndex < 0) return fail(doc, 'No page with after_page_id.');
  const to = afterIndex < from ? afterIndex + 1 : afterIndex;
  return {
    doc: ops.movePage(doc, from, to),
    result: 'ok',
    activity: `Moved page: ${doc.pages[from].title}`,
  };
};

const updateCourse: Handler = (doc, input) => ({
  doc: ops.updateCourse(doc, (d) => {
    if (typeof input.title === 'string') d.title = input.title;
    if (typeof input.pass_mark === 'number' || input.pass_mark === null)
      d.passMark = input.pass_mark as number | null;
    if (typeof input.accent === 'string') d.accent = input.accent;
    if (typeof input.nav_bar === 'boolean') d.navBar = input.nav_bar;
    if (Array.isArray(input.variables)) {
      d.variables = input.variables as Variable[];
      fillIds(d.variables);
    }
  }),
  result: 'ok',
  activity: 'Updated course settings',
});

const importMediaTool: Handler = async (doc, input, ctx) => {
  try {
    const url = await ctx.importMedia(String(input.url ?? ''));
    return { doc, result: JSON.stringify({ url }), activity: 'Downloaded a media file' };
  } catch (e) {
    return fail(doc, e instanceof Error ? e.message : 'Download failed.');
  }
};

const HANDLERS: Record<string, Handler> = {
  get_page: getPage,
  add_page: addPage,
  update_blocks: updateBlocks,
  add_blocks: addBlocks,
  remove_blocks: removeBlocks,
  make_button: makeButton,
  add_note: addNote,
  update_page: updatePage,
  delete_page: deletePage,
  move_page: movePage,
  update_course: updateCourse,
  import_media: importMediaTool,
};

export async function runTool(
  doc: CourseDoc,
  name: string,
  input: Input,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const handler = HANDLERS[name];
  return handler ? handler(doc, input, ctx) : fail(doc, `Unknown tool ${name}.`);
}
