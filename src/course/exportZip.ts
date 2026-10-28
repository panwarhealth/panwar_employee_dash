import JSZip from 'jszip';
import type { CourseDoc } from './doc';
import { scoredQuestions } from './doc';
import { layoutsFor } from './canvasLayout';

const MEDIA_URL = /https:\/\/[^"\s]+\/courses\/[0-9a-f]{32}\/[0-9a-f]{32}\.[a-z0-9]+/g;
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

export interface Check {
  ok: boolean;
  text: string;
}

export function mediaUrls(doc: CourseDoc): string[] {
  return [...new Set(JSON.stringify(doc).match(MEDIA_URL) ?? [])];
}

export function preflight(doc: CourseDoc): Check[] {
  const checks: Check[] = [];
  const blocks = doc.pages.flatMap((p) => p.blocks);
  const emptyPages = doc.pages.filter((p) => p.blocks.length === 0);
  checks.push(
    emptyPages.length
      ? {
          ok: false,
          text: `${plural(emptyPages.length, 'page')} with nothing on it: ${emptyPages.map((p) => p.title).join(', ')}`,
        }
      : {
          ok: true,
          text: `${plural(doc.pages.length, 'page')}, ${plural(blocks.length, 'block')}`,
        },
  );

  const needsFile = ['image', 'video', 'audio', 'animation', 'hotspots'];
  const missing = blocks.filter(
    (b) =>
      (needsFile.includes(b.type) && 'src' in b && !b.src) ||
      (b.type === 'embed' && !b.url) ||
      (b.type === 'drag' && b.style === 'targets' && !b.src),
  );
  if (missing.length)
    checks.push({
      ok: false,
      text: `${plural(missing.length, 'media block')} without a file or link`,
    });

  const notes = doc.pages.filter((p) => p.notes?.length);
  if (notes.length)
    checks.push({
      ok: false,
      text: `Review notes still open on: ${notes.map((p) => p.title).join(', ')}`,
    });

  const pageIds = new Set(doc.pages.map((p) => p.id));
  const triggerActions = doc.pages.flatMap((p) => p.triggers.map((t) => t.action));
  const targets = [
    ...triggerActions,
    ...blocks.flatMap((b) => (b.type === 'button' ? [b.action] : [])),
  ];
  const blockIds = new Set(blocks.map((b) => b.id));
  const deadLinks = targets.filter(
    (a) =>
      (a.kind === 'page' && !pageIds.has(a.pageId)) ||
      ((a.kind === 'popup' || a.kind === 'show' || a.kind === 'hide') && !blockIds.has(a.blockId)),
  );
  const leaves = (a: { kind: string }) => ['next', 'page', 'finish'].includes(a.kind);
  const stuck = doc.navBar
    ? []
    : doc.pages.filter(
        (p) =>
          !p.blocks.some(
            (b) =>
              (b.type === 'button' && b.action.kind !== 'link') ||
              (b.type === 'pathway' && b.choices.length > 0) ||
              b.type === 'results',
          ) && !p.triggers.some((t) => leaves(t.action)),
      );
  if (stuck.length)
    checks.push({
      ok: false,
      text: `No way to move on from: ${stuck.map((p) => p.title).join(', ')} (add a button that goes to the next page, or turn on the Back and Continue bar in course settings)`,
    });

  const unsetPaths = blocks.filter(
    (b) => b.type === 'pathway' && b.choices.some((c) => !pageIds.has(c.pageId)),
  );
  if (unsetPaths.length)
    checks.push({
      ok: false,
      text: `${plural(unsetPaths.length, 'pathway choice')} block with a choice that goes nowhere`,
    });
  if (deadLinks.length)
    checks.push({
      ok: false,
      text: `${plural(deadLinks.length, 'click action')} going to a page or pop-up that no longer exists`,
    });

  for (const layout of layoutsFor(doc.screens)) {
    const unset = doc.pages.filter((p) => p.blocks.some((b) => !b.frames?.[layout]));
    if (unset.length)
      checks.push({
        ok: false,
        text: `${layout === 'phone' ? 'Phone' : 'Desktop'} layout not set up on: ${unset.map((p) => p.title).join(', ')}`,
      });
  }

  const scored = scoredQuestions(doc).length;
  if (doc.passMark === null)
    checks.push({
      ok: true,
      text: 'No pass mark: completes when the learner finishes',
    });
  else if (scored === 0)
    checks.push({
      ok: false,
      text: `Pass mark is ${doc.passMark}% but no questions count toward it`,
    });
  else
    checks.push({
      ok: true,
      text: `Pass mark ${doc.passMark}% across ${plural(scored, 'scored question')}`,
    });

  return checks;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'course';

function manifest(title: string, slug: string): string {
  const t = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.panwarhealth.${slug}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${t}</title>
      <item identifier="item1" identifierref="res1">
        <title>${t}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`;
}

export async function buildZip(
  doc: CourseDoc,
  download: (url: string) => Promise<Blob>,
  onProgress: (text: string) => void,
): Promise<{ blob: Blob; mediaBytes: number }> {
  const zip = new JSZip();

  const files = (await (await fetch('/scorm-player/files.json')).json()) as string[];
  for (const f of files) {
    const res = await fetch(`/scorm-player/${f}`);
    if (!res.ok) throw new Error(`The course player is missing ${f}`);
    zip.file(f, await res.blob());
  }

  let json = JSON.stringify(doc);
  let mediaBytes = 0;
  const urls = mediaUrls(doc);
  for (const [i, url] of urls.entries()) {
    onProgress(`Bundling media ${i + 1} of ${urls.length}`);
    const blob = await download(url);
    mediaBytes += blob.size;
    if (mediaBytes > MAX_MEDIA_BYTES) throw new Error('Media is over 100 MB. Use smaller videos.');
    const name = `media/${url.split('/').pop()}`;
    zip.file(name, blob);
    json = json.split(url).join(name);
  }

  zip.file('course.json', json);
  zip.file('imsmanifest.xml', manifest(doc.title, slugify(doc.title)));
  onProgress('Zipping');
  return { blob: await zip.generateAsync({ type: 'blob' }), mediaBytes };
}
