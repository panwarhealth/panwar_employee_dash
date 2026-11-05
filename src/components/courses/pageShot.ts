import { isHiddenPopup, type CourseDoc, type Layout, type Page } from '@/course/doc';
import { mediaUrls } from '@/course/exportZip';
import { cueHidden } from '@/course/grading';
import { withStage } from './offscreenStage';

export async function withLocalMedia<T>(
  doc: CourseDoc,
  fetchMedia: (url: string) => Promise<Blob>,
  render: (doc: CourseDoc) => Promise<T>,
): Promise<T> {
  const local = await Promise.all(
    mediaUrls(doc).map(async (url) => [url, URL.createObjectURL(await fetchMedia(url))] as const),
  );
  let json = JSON.stringify(doc);
  for (const [url, blobUrl] of local) json = json.split(url).join(blobUrl);
  try {
    return await render(JSON.parse(json) as CourseDoc);
  } finally {
    for (const [, blobUrl] of local) URL.revokeObjectURL(blobUrl);
  }
}

function learnerHidden(page: Page): Set<string> {
  const hidden = cueHidden(page, {});
  for (const b of page.blocks) if (b.startHidden || isHiddenPopup(b)) hidden.add(b.id);
  return hidden;
}

async function bakeBackdropBlur(
  page: Page,
  stage: HTMLElement,
  objects: HTMLElement[],
  pixelRatio: number,
) {
  const { toCanvas } = await import('html-to-image');
  const origin = stage.getBoundingClientRect();
  for (let i = 0; i < page.blocks.length; i++) {
    const b = page.blocks[i];
    const shape = objects[i]?.querySelector<HTMLElement>('.cp-shape');
    if (b.type !== 'shape' || !b.blur || !shape) continue;
    const above = objects.slice(i);
    above.forEach((o) => (o.style.visibility = 'hidden'));
    const below = await toCanvas(stage, { pixelRatio, backgroundColor: '#ffffff' });
    above.forEach((o) => (o.style.visibility = ''));
    const blurred = document.createElement('canvas');
    blurred.width = below.width;
    blurred.height = below.height;
    const soft = blurred.getContext('2d')!;
    soft.filter = `blur(${b.blur * pixelRatio}px)`;
    soft.drawImage(below, 0, 0);
    const r = shape.getBoundingClientRect();
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(r.width * pixelRatio));
    crop.height = Math.max(1, Math.round(r.height * pixelRatio));
    crop
      .getContext('2d')!
      .drawImage(blurred, (origin.left - r.left) * pixelRatio, (origin.top - r.top) * pixelRatio);
    const look = getComputedStyle(shape);
    const layers = [
      look.backgroundImage !== 'none' ? look.backgroundImage : '',
      `linear-gradient(${look.backgroundColor}, ${look.backgroundColor})`,
      `url("${crop.toDataURL('image/jpeg', 0.9)}") 0 0 / 100% 100% no-repeat`,
    ].filter(Boolean);
    shape.style.background = layers.join(', ');
    shape.style.backgroundOrigin = 'border-box';
    shape.style.backdropFilter = 'none';
    shape.style.setProperty('-webkit-backdrop-filter', 'none');
  }
}

export async function snapshotWithBoxes(
  doc: CourseDoc,
  page: Page,
  layout: Layout,
  pixelRatio = 2,
): Promise<{ jpeg: string; boxes: Map<string, number[]> }> {
  const { toJpeg } = await import('html-to-image');
  return withStage(
    doc,
    page,
    layout,
    async (stage) => {
      const origin = stage.getBoundingClientRect();
      const objects = Array.from(stage.querySelectorAll<HTMLElement>(':scope > .cp-obj'));
      const boxes = new Map<string, number[]>();
      page.blocks.forEach((b, i) => {
        const r = objects[i]?.getBoundingClientRect();
        if (r?.width)
          boxes.set(
            b.id,
            [r.left - origin.left, r.top - origin.top, r.width, r.height].map(Math.round),
          );
      });
      await bakeBackdropBlur(page, stage, objects, pixelRatio);
      const jpeg = await toJpeg(stage, { pixelRatio, quality: 0.85, backgroundColor: '#ffffff' });
      return { jpeg, boxes };
    },
    { hidden: learnerHidden(page), className: 'cp-still' },
  );
}

export const snapshot = async (doc: CourseDoc, page: Page, layout: Layout) =>
  (await snapshotWithBoxes(doc, page, layout)).jpeg;
