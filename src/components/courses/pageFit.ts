import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CanvasStage } from '@/course/canvas';
import { frameFor, growsToFit, layoutsFor } from '@/course/canvasLayout';
import type { Block, CourseDoc, Layout, Page } from '@/course/doc';
import { editContext } from '@/course/editContext';

const STAGE_WIDTH: Record<Layout, number> = { desktop: 960, phone: 360 };

const isLight = (colour: string | undefined) => {
  const hex = colour?.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r > 220 && g > 220 && b > 220;
};

const fillOf = (b: Block) => ('fill' in b ? b.fill : undefined);

async function settle(host: HTMLElement) {
  await document.fonts.ready;
  const pending = Array.from(host.querySelectorAll('img')).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(pending.map((img) => new Promise((done) => (img.onload = img.onerror = done)))),
    new Promise((done) => setTimeout(done, 4000)),
  ]);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}

async function measure(doc: CourseDoc, page: Page, layout: Layout): Promise<string[]> {
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
    const objects = Array.from(host.querySelectorAll('.cp-stage > .cp-obj'));
    const out: string[] = [];
    page.blocks.forEach((b, i) => {
      const el = objects[i];
      if (!el) return;
      const box = el.getBoundingClientRect();
      const where = `${b.type} ${b.id} (${layout} layout)`;
      if (box.bottom > stage.bottom + 2 || box.right > stage.right + 2)
        out.push(`${where} runs off the page. Keep everything inside the stage.`);
      if (growsToFit(b)) {
        const frameH = (frameFor(page, b, layout).h / 100) * stage.height;
        if (box.height > frameH * 1.08)
          out.push(
            `${where} needs ${Math.round((box.height / stage.height) * 100)}% of the page height but its frame is ${frameFor(page, b, layout).h}%. Make the font smaller or give it a bigger frame; never cut the wording.`,
          );
      }
      const scaled = el.querySelector<HTMLElement>(':scope > .cp-fit > .cp-fit-in')?.style
        .transform;
      const s = scaled?.match(/scale\(([\d.]+)\)/)?.[1];
      if (s && Number(s) < 0.75)
        out.push(
          `${where} has more content than its frame and is shrunk to ${Math.round(Number(s) * 100)}% to fit. Give it a bigger frame.`,
        );
    });
    return out;
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function pageFitWarnings(doc: CourseDoc, page: Page): Promise<string[]> {
  if (page.kind !== 'canvas')
    return [
      `Page ${page.id} is a flow page, which scrolls. Build it as a canvas page so it fits the screen.`,
    ];
  const out: string[] = [];
  for (const b of page.blocks)
    if (
      (b.type === 'heading' || b.type === 'text' || b.type === 'scroll') &&
      isLight(b.textStyle?.color) &&
      !fillOf(b)
    )
      out.push(
        `${b.type} ${b.id} has white text and no background, so it is invisible on the white page. Give it a fill or a dark colour.`,
      );
  for (const layout of layoutsFor(doc.screens)) out.push(...(await measure(doc, page, layout)));
  return out;
}
