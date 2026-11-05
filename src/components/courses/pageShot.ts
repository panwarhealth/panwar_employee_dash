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
      const objects = Array.from(stage.querySelectorAll(':scope > .cp-obj'));
      const boxes = new Map<string, number[]>();
      page.blocks.forEach((b, i) => {
        const r = objects[i]?.getBoundingClientRect();
        if (r?.width)
          boxes.set(
            b.id,
            [r.left - origin.left, r.top - origin.top, r.width, r.height].map(Math.round),
          );
      });
      const jpeg = await toJpeg(stage, { pixelRatio, quality: 0.85, backgroundColor: '#ffffff' });
      return { jpeg, boxes };
    },
    { hidden: learnerHidden(page), className: 'cp-still' },
  );
}

export const snapshot = async (doc: CourseDoc, page: Page, layout: Layout) =>
  (await snapshotWithBoxes(doc, page, layout)).jpeg;
