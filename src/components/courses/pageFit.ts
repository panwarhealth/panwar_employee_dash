import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CanvasStage } from '@/course/canvas';
import { layoutsFor } from '@/course/canvasLayout';
import type { CourseDoc, Layout, Page } from '@/course/doc';
import { editContext } from '@/course/editContext';

const STAGE_WIDTH: Record<Layout, number> = { desktop: 960, phone: 360 };

async function settle(host: HTMLElement) {
  await document.fonts.ready;
  const pending = Array.from(host.querySelectorAll('img')).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(pending.map((img) => new Promise((done) => (img.onload = img.onerror = done)))),
    new Promise((done) => setTimeout(done, 4000)),
  ]);
}

async function offscreen<T>(
  doc: CourseDoc,
  page: Page,
  layout: Layout,
  read: (stage: DOMRect, objects: Element[]) => T,
): Promise<T> {
  const host = document.createElement('div');
  host.className = 'cp';
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${STAGE_WIDTH[layout]}px;visibility:hidden;pointer-events:none`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(createElement(CanvasStage, { page, layout, ctx: editContext(doc) })),
    );
    await settle(host);
    const stage = host.querySelector('.cp-stage')!.getBoundingClientRect();
    return read(stage, Array.from(host.querySelectorAll('.cp-stage > .cp-obj')));
  } finally {
    root.unmount();
    host.remove();
  }
}

export const measureHeights = (doc: CourseDoc, page: Page, layout: Layout) =>
  offscreen(doc, page, layout, (stage, objects) => {
    const out = new Map<string, number>();
    page.blocks.forEach((b, i) => {
      const el = objects[i];
      if (!el) return;
      const content = el.querySelector<HTMLElement>(':scope > .cp-fit > .cp-fit-in > :first-child');
      if (content) content.style.height = 'auto';
      const height = content ? content.offsetHeight : el.getBoundingClientRect().height;
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
          `${where} has more content than its frame and is shrunk to ${Math.round(Number(s) * 100)}% to fit. Give it a bigger frame.`,
        );
    });
    return out;
  });

export async function pageFitWarnings(
  doc: CourseDoc,
  page: Page,
  layouts: Layout[] = layoutsFor(doc.screens),
): Promise<string[]> {
  if (page.kind !== 'canvas')
    return [
      `Page ${page.id} is a flow page, which scrolls. Build it as a canvas page so it fits the screen.`,
    ];
  const out: string[] = [];
  for (const layout of layouts) out.push(...(await measure(doc, page, layout)));
  return out;
}
