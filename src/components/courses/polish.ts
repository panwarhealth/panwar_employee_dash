import type { AssistantMessage, AssistantReply } from '@/api/courses';
import type { Block, CourseDoc, Frame, Insets, Layout, Page, TextStyle } from '@/course/doc';
import { layoutsFor, lookFor, MENU_CORNER } from '@/course/canvasLayout';
import { round1 } from '@/course/geometry';
import { blockText } from '@/course/text';
import * as ops from '@/course/edit';
import { DESIGN, isRound } from './blockKinds';
import { blockLabel } from './blockMeta';
import { snapshotWithBoxes, withLocalMedia } from './pageShot';

const STAGE: Record<Layout, { w: number; h: number }> = {
  desktop: DESIGN,
  phone: { w: 360, h: 640 },
};
const SHOT_RATIO: Record<Layout, number> = { desktop: 1, phone: 2 };

const ROUNDS = 2;
const AT_ONCE = 8;
const TRIES = 2;
const MIN_TEXT_PX = 10;
const MAX_TEXT_PX = 96;
const BODY_CHARS = 40;

const PHONE_RULES = `
- Phone pages: objects stack down one column in reading order, each the width it needs inside the 20 px margins, with even gaps between them. Nothing sits side by side unless it fits comfortably. Body text is at least 14 px. Keep buttons and anything to click out of the menu button's corner: the left ${MENU_CORNER.phone.w}% by top ${MENU_CORNER.phone.h}% of the stage. Everything fits on the stage.`;

const polishSystem = (layout: Layout) => `You are a senior visual designer giving the final polish to one page of an e-learning course that was imported from PowerPoint. You get a picture of the page as the learner sees it on ${layout === 'phone' ? 'a phone' : 'a computer'} (a ${STAGE[layout].w} x ${STAGE[layout].h} px stage) and the list of its objects in stage pixels: box is the frame you can change, and shows at is where the object really lands on screen (text boxes grow taller to fit their text; everything else shrinks its contents to fit its box). Judge spacing from what shows. Look at the picture as a picky designer would: most imported pages need a few fixes. Make them with the tidy tool:

- Icon buttons (round or square buttons holding one character like <, x, i, R, or a small icon): the character is about half the button's height and centred. Buttons with the same job are the same size everywhere on the page and line up with each other. Round buttons stay perfectly round (width = height).
- Text buttons: the label has comfortable room around it, at least 12 px above and below and 24 px either side, and never crowds or overflows the button. Buttons on a page share one height and label size.
- Text boxes with a background or border: the text sits at the top of the box with 20 px padding on every side and line height 1.3; never crammed against its edges. Icon buttons use padding 0 so the character centres.
- Panels and cards: everything sitting on a panel is at least 24 px in from its edges. Text that starts together shares one left edge. A panel hugs its content: no big dead areas; shrink the panel or spread the content so the space is balanced.
- Text: sizes follow a clear hierarchy (heading bigger than body). Never make body text smaller (make its box bigger instead); bring body text under 14 px up to the course's body size when there's room. Leave at least 12 px between a heading and the text under it and between separate blocks of text. Nothing touches, clips or unintentionally overlaps another object, and nothing leaves the stage.
- Match the course standards you're given, so every page looks like part of the same course.${layout === 'phone' ? PHONE_RULES : ''}

Keep the design: never change wording, colours, pictures or layer order, never delete anything, and don't move objects to a different part of the page. Make small, precise adjustments. A full-stage background picture stays as it is. If the page already looks right, don't call the tool; just reply DONE.`;

const TIDY_TOOL = {
  name: 'tidy',
  description:
    'Adjust objects on the page. box is [x, y, width, height] in stage pixels; size is the font size in px; line_height is a multiple of the font size; radius is the corner radius in px; padding is the room between the edges of a text box and its text, [top, right, bottom, left] in px. Send only what changes.',
  input_schema: {
    type: 'object',
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            box: { type: 'array', items: { type: 'number' } },
            size: { type: 'number' },
            line_height: { type: 'number' },
            radius: { type: 'number' },
            padding: { type: 'array', items: { type: 'number' } },
          },
          required: ['id'],
        },
      },
    },
    required: ['changes'],
  },
};

interface Tidy {
  id?: unknown;
  box?: unknown;
  size?: unknown;
  line_height?: unknown;
  radius?: unknown;
  padding?: unknown;
}

type Styled = Block & { textStyle?: TextStyle; radius?: number; padding?: Insets };

const pxBox = (f: Frame, layout: Layout) => [
  Math.round((f.x / 100) * STAGE[layout].w),
  Math.round((f.y / 100) * STAGE[layout].h),
  Math.round((f.w / 100) * STAGE[layout].w),
  Math.round((f.h / 100) * STAGE[layout].h),
];

const isIcon = (b: Block) => isRound(b) && blockText(b).trim().length <= 3;

function mode(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function standards(doc: CourseDoc, layout: Layout): string {
  const blocks = doc.pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.frames?.[layout])
    .map((b) => lookFor(b, layout)) as Styled[];
  const icon = mode(blocks.filter(isIcon).map((b) => pxBox(b.frames![layout]!, layout)[3]));
  const label = mode(
    blocks.filter((b) => b.type === 'button' && b.textStyle?.size).map((b) => b.textStyle!.size!),
  );
  const body = mode(
    blocks
      .filter((b) => b.type === 'text' && blockText(b).length > 60 && b.textStyle?.size)
      .map((b) => b.textStyle!.size!),
  );
  return [
    icon && `icon buttons ${icon} px`,
    label && `button labels ${label} px`,
    body && `body text ${body} px`,
  ]
    .filter(Boolean)
    .join(', ');
}

function describe(page: Page, shown: Map<string, number[]>, layout: Layout): string {
  return page.blocks
    .filter((b) => b.frames?.[layout])
    .map((b) => lookFor(b, layout) as Styled)
    .map((b) => {
      const text = blockText(b).replace(/\s+/g, ' ').trim();
      const parts = [
        `${b.id} ${b.type}${isRound(b) ? ' (round)' : ''}`,
        `box [${pxBox(b.frames![layout]!, layout).join(', ')}]`,
        shown.get(b.id) && `shows at [${shown.get(b.id)!.join(', ')}]`,
        b.textStyle?.size && `size ${b.textStyle.size}`,
        b.textStyle?.lineHeight && `line_height ${b.textStyle.lineHeight}`,
        b.radius && `radius ${b.radius}`,
        b.padding && `padding [${b.padding.join(', ')}]`,
        text && `"${text.slice(0, 70)}${text.length > 70 ? '...' : ''}"`,
      ];
      return `- ${parts.filter(Boolean).join(', ')}`;
    })
    .join('\n');
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function applyTidy(doc: CourseDoc, pageId: string, changes: Tidy[], layout: Layout): CourseDoc {
  const { w, h } = STAGE[layout];
  return ops.updatePage(doc, pageId, (p) => {
    for (const c of changes) {
      const found = p.blocks.find((x) => x.id === c.id);
      const f = found?.frames?.[layout];
      if (!found || !f) continue;
      const box = Array.isArray(c.box) ? c.box.map(num) : [];
      if (box.length === 4 && box.every((v) => v !== undefined) && box[2]! > 0 && box[3]! > 0)
        found.frames![layout] = {
          ...f,
          x: round1((box[0]! / w) * 100),
          y: round1((box[1]! / h) * 100),
          w: round1((box[2]! / w) * 100),
          h: round1((box[3]! / h) * 100),
        };
      ops.changeLook(found, layout, layoutsFor(doc.screens)[0], (shown) => restyle(shown, c));
    }
  });
}

function restyle(block: Block, c: Tidy) {
  const b = block as Styled;
  const size = num(c.size);
  const shrinksBody =
    size !== undefined &&
    size < (b.textStyle?.size ?? 0) &&
    blockText(b).length > BODY_CHARS;
  if (b.textStyle && size && size >= MIN_TEXT_PX && size <= MAX_TEXT_PX && !shrinksBody)
    b.textStyle = { ...b.textStyle, size: Math.round(size) };
  const lineHeight = num(c.line_height);
  if (b.textStyle && lineHeight && lineHeight >= 0.8 && lineHeight <= 2.5)
    b.textStyle = { ...b.textStyle, lineHeight };
  const radius = num(c.radius);
  if ('radius' in b && radius !== undefined && radius >= 0) b.radius = Math.round(radius);
  const padding = Array.isArray(c.padding) ? c.padding.map(num) : [];
  if (
    (b.type === 'text' || b.type === 'heading') &&
    padding.length === 4 &&
    padding.every((v) => v !== undefined && v >= 0)
  )
    b.padding = padding.map((v) => Math.round(v!)) as Insets;
}

export interface PolishContext {
  getDoc: () => CourseDoc;
  apply: (doc: CourseDoc) => void;
  turn: (body: {
    system: string;
    tools: unknown[];
    messages: AssistantMessage[];
  }) => Promise<AssistantReply>;
  fetchMedia: (url: string) => Promise<Blob>;
  addCost: (usd: number) => void;
  signal: AbortSignal;
}

async function polishPage(ctx: PolishContext, pageId: string, house: string, layout: Layout) {
  for (let round = 0; round < ROUNDS; round++) {
    const doc = ctx.getDoc();
    const page = doc.pages.find((p) => p.id === pageId);
    if (!page) return;
    const { jpeg, boxes } = await withLocalMedia(
      { ...doc, pages: [page] },
      ctx.fetchMedia,
      (local) => snapshotWithBoxes(local, local.pages[0], layout, SHOT_RATIO[layout]),
    );
    const reply = await ctx.turn({
      system: polishSystem(layout),
      tools: [TIDY_TOOL],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.split(',')[1] },
            },
            {
              type: 'text',
              text: `${round ? 'This is the page after your last changes. Fix anything still off, or reply DONE.\n\n' : ''}Course standards: ${house || 'none yet'}.\n\nObjects on page "${page.title}", back to front:\n${describe(page, boxes, layout)}`,
            },
          ],
        },
      ],
    });
    ctx.addCost(reply.usage?.cost_usd ?? 0);
    const changes = reply.content
      .filter((b) => b.type === 'tool_use' && b.name === 'tidy')
      .flatMap((b) => {
        const list = (b.input as { changes?: unknown } | undefined)?.changes;
        return Array.isArray(list) ? (list as Tidy[]) : [];
      });
    if (!changes.length) return;
    ctx.apply(applyTidy(ctx.getDoc(), pageId, changes, layout));
  }
}

export async function polishCourse(
  ctx: PolishContext,
  onStatus: (message: string) => void,
): Promise<{ pageId: string; error: string }[]> {
  const house = standards(ctx.getDoc(), 'desktop');
  const queue = ctx
    .getDoc()
    .pages.filter((p) => p.blocks.some((b) => b.frames?.desktop))
    .map((p) => p.id);
  const total = queue.length;
  let done = 0;
  const failed: { pageId: string; error: string }[] = [];
  const attempt = async (id: string, tries: number): Promise<void> => {
    try {
      await polishPage(ctx, id, house, 'desktop');
    } catch (e) {
      if (ctx.signal.aborted) throw e;
      if (tries > 1) return attempt(id, tries - 1);
      failed.push({ pageId: id, error: e instanceof Error ? e.message : String(e) });
    }
  };
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await attempt(id, TRIES);
      onStatus(`Polishing the design (${++done} of ${total} pages)`);
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
  return failed;
}

export const polishOnePage = (ctx: PolishContext, pageId: string, layout: Layout) =>
  polishPage(ctx, pageId, standards(ctx.getDoc(), layout), layout);

export function polishChanges(before: Page, after: Page, layout: Layout): string[] {
  return after.blocks.flatMap((b) => {
    const old = before.blocks.find((x) => x.id === b.id);
    if (!old) return [];
    const was = lookFor(old, layout) as Styled;
    const now = lookFor(b, layout) as Styled;
    const from = old.frames?.[layout];
    const to = b.frames?.[layout];
    const parts = [
      from && to && pxBox(from, layout).join() !== pxBox(to, layout).join()
        ? `box [${pxBox(from, layout).join(', ')}] to [${pxBox(to, layout).join(', ')}]`
        : '',
      was.textStyle?.size !== now.textStyle?.size
        ? `text size ${was.textStyle?.size ?? 'default'} to ${now.textStyle?.size}`
        : '',
      was.textStyle?.lineHeight !== now.textStyle?.lineHeight
        ? `line height ${was.textStyle?.lineHeight ?? 'default'} to ${now.textStyle?.lineHeight}`
        : '',
      was.radius !== now.radius ? `corner radius ${was.radius ?? 0} to ${now.radius}` : '',
      String(was.padding) !== String(now.padding)
        ? `padding ${was.padding?.join(' ') ?? 'default'} to ${now.padding?.join(' ')}`
        : '',
    ].filter(Boolean);
    return parts.length ? [`${blockLabel(b).slice(0, 40)} (${b.id}): ${parts.join(', ')}`] : [];
  });
}
