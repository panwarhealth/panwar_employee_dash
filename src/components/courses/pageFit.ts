import { layoutsFor } from '@/course/canvasLayout';
import type { CourseDoc, Layout, Page } from '@/course/doc';
import { withStage } from './offscreenStage';

const offscreen = <T>(
  doc: CourseDoc,
  page: Page,
  layout: Layout,
  read: (stage: DOMRect, objects: Element[]) => T,
) =>
  withStage(doc, page, layout, (stage) =>
    read(stage.getBoundingClientRect(), Array.from(stage.querySelectorAll(':scope > .cp-obj'))),
  );

export const measureHeights = (doc: CourseDoc, page: Page, layout: Layout) =>
  offscreen(doc, page, layout, (stage, objects) => {
    const out = new Map<string, number>();
    page.blocks.forEach((b, i) => {
      const el = objects[i] as HTMLElement | undefined;
      if (!el) return;
      const content = el.querySelector<HTMLElement>(':scope > .cp-fit > .cp-fit-in > :first-child');
      let height: number;
      if (content) {
        content.style.height = 'auto';
        const scale = content.parentElement?.style.transform.match(/scale\(([\d.]+)\)/)?.[1];
        height = content.getBoundingClientRect().height / Number(scale ?? 1);
      } else {
        el.style.minHeight = '0';
        height = el.getBoundingClientRect().height;
      }
      out.set(b.id, (height / stage.height) * 100);
    });
    return out;
  });

const measure = (doc: CourseDoc, page: Page, layout: Layout) =>
  offscreen(doc, page, layout, (stage, objects) => {
    const out: string[] = [];
    page.blocks.forEach((b, i) => {
      const el = objects[i];
      if (!el) return;
      const box = el.getBoundingClientRect();
      const where = `${b.type} ${b.id} (${layout} layout)`;
      if (box.bottom > stage.bottom + 2 || box.right > stage.right + 2)
        out.push(`${where} runs off the page. Keep everything inside the stage.`);
      const scaled = el.querySelector<HTMLElement>(':scope > .cp-fit > .cp-fit-in')?.style
        .transform;
      const s = scaled?.match(/scale\(([\d.]+)\)/)?.[1];
      if (s && Number(s) < 0.5)
        out.push(
          `${where} has more content than its frame and is shrunk to ${Math.round(Number(s) * 100)}% to fit. Nothing may scroll: give it more room, or split the content across pages or into a tabs block.`,
        );
    });
    return out;
  });

export async function pageFitWarnings(
  doc: CourseDoc,
  page: Page,
  layouts: Layout[] = layoutsFor(doc.screens),
): Promise<string[]> {
  const out: string[] = [];
  for (const layout of layouts) out.push(...(await measure(doc, page, layout)));
  return out;
}
