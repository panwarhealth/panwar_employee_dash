import type { CourseDoc, Layout, Page } from '@/course/doc';
import { withLocalMedia, withStage } from './offscreenStage';
import './coursePdf.css';

type NativeDropper = new () => { open(): Promise<{ sRGBHex: string }> };

const hex = (n: number) => n.toString(16).padStart(2, '0');

async function nativePick(Dropper: NativeDropper): Promise<string | undefined> {
  try {
    return (await new Dropper().open()).sRGBHex.toUpperCase();
  } catch {
    return undefined;
  }
}

function snapshot(
  doc: CourseDoc,
  page: Page,
  layout: Layout,
  fetchMedia: (url: string) => Promise<Blob>,
): Promise<HTMLCanvasElement> {
  return withLocalMedia({ ...doc, pages: [page] }, fetchMedia, async (local) => {
    const { toCanvas } = await import('html-to-image');
    return withStage(
      local,
      local.pages[0],
      layout,
      (stage) => toCanvas(stage, { pixelRatio: 2, backgroundColor: '#ffffff' }),
      { className: 'cp-still' },
    );
  });
}

function pickFrom(shot: HTMLCanvasElement, at: DOMRect): Promise<string | undefined> {
  const pixels = shot.getContext('2d', { willReadFrequently: true })!;
  const cover = document.createElement('div');
  cover.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:crosshair';
  Object.assign(shot.style, {
    position: 'fixed',
    left: `${at.left}px`,
    top: `${at.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
    boxShadow: '0 0 0 3px #702f8f',
  });
  const chip = document.createElement('div');
  chip.style.cssText =
    'position:fixed;display:none;align-items:center;gap:6px;padding:4px 8px 4px 4px;background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:6px;font:12px/1 sans-serif;color:#2f3030;box-shadow:0 2px 8px rgba(0,0,0,.15);pointer-events:none';
  const dot = document.createElement('span');
  dot.style.cssText = 'width:20px;height:20px;border-radius:4px;border:1px solid rgba(0,0,0,.2)';
  const label = document.createElement('span');
  chip.append(dot, label);
  const hint = document.createElement('div');
  hint.textContent = 'Click the page to pick a colour. Esc to cancel.';
  hint.style.cssText = `position:fixed;left:${at.left}px;top:${Math.max(4, at.top - 30)}px;padding:4px 8px;background:#702f8f;color:#fff;border-radius:4px;font:12px/1.4 sans-serif`;
  cover.append(shot, chip, hint);
  document.body.appendChild(cover);

  const colourAt = (e: MouseEvent) => {
    const x = Math.floor(((e.clientX - at.left) / at.width) * shot.width);
    const y = Math.floor(((e.clientY - at.top) / at.height) * shot.height);
    if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) return undefined;
    const [r, g, b] = pixels.getImageData(x, y, 1, 1).data;
    return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
  };

  return new Promise((done) => {
    const finish = (colour: string | undefined) => {
      cover.remove();
      window.removeEventListener('keydown', key, true);
      done(colour);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      finish(undefined);
    };
    cover.addEventListener('mousemove', (e) => {
      const colour = colourAt(e);
      chip.style.display = colour ? 'flex' : 'none';
      if (!colour) return;
      Object.assign(chip.style, { left: `${e.clientX + 16}px`, top: `${e.clientY + 16}px` });
      dot.style.background = colour;
      label.textContent = colour;
    });
    cover.addEventListener('click', (e) => finish(colourAt(e)));
    window.addEventListener('keydown', key, true);
  });
}

export async function pickColour(
  doc: CourseDoc,
  page: Page,
  layout: Layout,
  onScreen: HTMLElement | null,
  fetchMedia: (url: string) => Promise<Blob>,
): Promise<string | undefined> {
  const Dropper = (window as { EyeDropper?: NativeDropper }).EyeDropper;
  if (Dropper) return nativePick(Dropper);
  if (!onScreen) return undefined;
  const shot = await snapshot(doc, page, layout, fetchMedia);
  return pickFrom(shot, onScreen.getBoundingClientRect());
}
