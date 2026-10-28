import { layoutsFor } from '@/course/canvasLayout';
import { isHiddenPopup, isQuestion, type CourseDoc, type Page } from '@/course/doc';
import { overlapShare } from '@/course/geometry';
import { pageFitWarnings } from './pageFit';

export interface ToolOutcome {
  doc: CourseDoc;
  result: string;
  error?: boolean;
  activity?: string;
}

function linkWarnings(doc: CourseDoc, page: Page): string[] {
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
  return warnings;
}

function desktopWarnings(page: Page): string[] {
  const warnings: string[] = [];
  for (const b of page.blocks)
    if (!b.frames?.desktop)
      warnings.push(`Canvas block ${b.id} has no desktop frame, so it gets a default spot.`);
  for (const q of page.blocks.filter(isQuestion)) {
    const qf = q.frames?.desktop;
    if (!qf) continue;
    for (const b of page.blocks.slice(page.blocks.indexOf(q) + 1)) {
      const f = b.frames?.desktop;
      if (!f || isQuestion(b) || isHiddenPopup(b) || overlapShare(f, qf) <= 0.2) continue;
      warnings.push(
        `${b.type} ${b.id} covers question ${q.id} in the desktop layout. Questions draw their own box, so anything placed over one hides its answers.`,
      );
    }
  }
  return warnings;
}

export async function checkedOutcome(
  next: CourseDoc,
  pageId: string,
  touched: Set<string>,
  activity: string,
): Promise<ToolOutcome> {
  const page = next.pages.find((p) => p.id === pageId)!;
  const desktop = page.kind === 'canvas' && layoutsFor(next.screens).includes('desktop');
  const fit = desktop && touched.size ? await pageFitWarnings(next, page, ['desktop']) : [];
  const warnings = [
    ...(page.kind === 'canvas'
      ? []
      : [`Page ${page.id} is a flow page, which scrolls. Pages must be canvas pages.`]),
    ...linkWarnings(next, page),
    ...(desktop ? desktopWarnings(page) : []),
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
