import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CanvasStage } from '@/course/canvas';
import type { CourseDoc, Layout, Page } from '@/course/doc';
import { editContext } from '@/course/editContext';

export const STAGE_WIDTH: Record<Layout, number> = { desktop: 960, phone: 360 };

async function settle(host: HTMLElement) {
  await document.fonts.ready;
  const pending = Array.from(host.querySelectorAll('img')).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(pending.map((img) => new Promise((done) => (img.onload = img.onerror = done)))),
    new Promise((done) => setTimeout(done, 4000)),
  ]);
}

export async function withStage<T>(
  doc: CourseDoc,
  page: Page,
  layout: Layout,
  read: (stage: HTMLElement) => T | Promise<T>,
  {
    hidden,
    className = '',
    showFeedback = false,
  }: { hidden?: Set<string>; className?: string; showFeedback?: boolean } = {},
): Promise<T> {
  const host = document.createElement('div');
  host.className = `cp ${className}`;
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${STAGE_WIDTH[layout]}px;pointer-events:none`;
  host.style.setProperty('--cp-accent', doc.accent);
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(
        createElement(CanvasStage, {
          page,
          layout,
          ctx: { ...editContext(doc), showFeedback },
          hidden,
        }),
      ),
    );
    await settle(host);
    return await read(host.querySelector<HTMLElement>('.cp-stage')!);
  } finally {
    root.unmount();
    host.remove();
  }
}
