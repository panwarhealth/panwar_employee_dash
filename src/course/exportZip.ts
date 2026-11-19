import JSZip from 'jszip';
import type { Action, Block, ButtonAction, CourseDoc, Layout, Page } from './doc';
import { groupsOf, scoredQuestions } from './doc';
import { layoutsFor } from './canvasLayout';

const MEDIA_URL = /https:\/\/[^"\s]+\/courses\/[0-9a-f]{32}\/[0-9a-f]{32}\.[a-z0-9]+/g;
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const WOFF2 = /url\(\s*["']?([^"')]+)["']?\s*\)\s*format\(\s*["']woff2["']\s*\)/;

export interface PackageFile {
  path: string;
  blob: Blob;
}

async function bundleFonts(files: PackageFile[]): Promise<string> {
  const sheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    .map((l) => l.href)
    .filter((href) => new URL(href).origin !== location.origin);
  const faces: string[] = [];
  for (const href of sheets) {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`Could not fetch the fonts from ${new URL(href).host}`);
    for (const face of (await res.text()).match(/@font-face\s*{[^}]*}/g) ?? []) {
      const url = face.match(WOFF2)?.[1];
      if (!url) continue;
      const file = await fetch(new URL(url, href));
      if (!file.ok) throw new Error(`Could not download a font file from ${new URL(href).host}`);
      const name = `fonts/${faces.length + 1}.woff2`;
      files.push({ path: name, blob: await file.blob() });
      faces.push(face.replace(/src:[^;}]*/, `src:url("${name}") format("woff2")`));
    }
  }
  return faces.join('\n');
}

export interface CheckSpot {
  id: string;
  title: string;
  blockId?: string;
  layout?: Layout;
}

export interface Check {
  ok: boolean;
  text: string;
  pages?: CheckSpot[];
}

const named = (pages: Page[], at?: (p: Page) => string | undefined, layout?: Layout): CheckSpot[] =>
  pages.map((p) => ({ id: p.id, title: p.title || 'Untitled', blockId: at?.(p), layout }));

export function mediaUrls(doc: CourseDoc): string[] {
  return [...new Set(JSON.stringify(doc).match(MEDIA_URL) ?? [])];
}

const NEEDS_FILE = ['image', 'video', 'audio', 'animation', 'hotspots'];

const unfilledBlock = (b: Block) =>
  (NEEDS_FILE.includes(b.type) && 'src' in b && !b.src) ||
  (b.type === 'embed' && !b.url) ||
  (b.type === 'drag' && b.style === 'targets' && !b.src);

function deadActionTest(doc: CourseDoc) {
  const pageIds = new Set(doc.pages.map((p) => p.id));
  const blockIds = new Set([
    ...doc.pages.flatMap((p) => p.blocks.map((b) => b.id)),
    ...doc.pages.flatMap((p) => groupsOf(p).map((g) => g.id)),
  ]);
  return (a: Action | ButtonAction) =>
    (a.kind === 'page' && !pageIds.has(a.pageId)) ||
    ((a.kind === 'popup' || a.kind === 'show' || a.kind === 'hide') && !blockIds.has(a.blockId));
}

const leavesPage = (a: { kind: string }) => ['next', 'prev', 'page', 'finish'].includes(a.kind);

const stuckPage = (doc: CourseDoc, p: Page) =>
  !doc.navBar &&
  !p.blocks.some(
    (b) =>
      (b.type === 'button' && b.action.kind !== 'link') ||
      (b.type === 'pathway' && b.choices.length > 0) ||
      b.type === 'results',
  ) &&
  !p.triggers.some((t) => leavesPage(t.action));

export interface PageProblem {
  key: string;
  text: string;
  blockId?: string;
}

export function pageProblems(doc: CourseDoc, page: Page, layout: Layout): PageProblem[] {
  const out: PageProblem[] = [];
  const dead = deadActionTest(doc);
  const pageIds = new Set(doc.pages.map((p) => p.id));
  const here = new Set([...page.blocks.map((b) => b.id), ...groupsOf(page).map((g) => g.id)]);
  if (page.blocks.length === 0) out.push({ key: 'empty', text: 'This page has nothing on it.' });
  if (stuckPage(doc, page))
    out.push({
      key: 'stuck',
      text: 'No way to leave this page. Add a button or trigger that goes somewhere, or turn on the Back and Continue bar in course settings.',
    });
  for (const b of page.blocks) {
    if (unfilledBlock(b))
      out.push({ key: `file-${b.id}`, text: 'This has no file or link.', blockId: b.id });
    if (b.type === 'button' && dead(b.action))
      out.push({
        key: `button-${b.id}`,
        text: 'This button goes to a page, pop-up or object that no longer exists.',
        blockId: b.id,
      });
    if (b.type === 'pathway' && b.choices.some((c) => !pageIds.has(c.pageId)))
      out.push({ key: `path-${b.id}`, text: 'A choice here goes nowhere.', blockId: b.id });
  }
  for (const t of page.triggers) {
    if (!dead(t.action)) continue;
    const on = t.when.kind === 'click' ? t.when.blockId : null;
    out.push(
      on && here.has(on)
        ? {
            key: `trigger-${t.id}`,
            text: 'A click trigger on this goes to a page, pop-up or object that no longer exists.',
            blockId: on,
          }
        : {
            key: `trigger-${t.id}`,
            text: on
              ? 'A trigger on a deleted object goes to a page, pop-up or object that no longer exists. Delete it under Triggers, in the red Deleted object group.'
              : 'A trigger on this page goes to a page, pop-up or object that no longer exists. Find it under Triggers.',
          },
    );
  }
  if (layoutsFor(doc.screens).includes(layout)) {
    const unplaced = page.blocks.filter((b) => !b.frames?.[layout]);
    if (unplaced.length)
      out.push({
        key: 'layout',
        text: `${plural(unplaced.length, 'object')} not placed in the ${layout} layout.`,
        blockId: unplaced[0].id,
      });
  }
  return out;
}

export function preflight(doc: CourseDoc): Check[] {
  const checks: Check[] = [];
  const blocks = doc.pages.flatMap((p) => p.blocks);
  const emptyPages = doc.pages.filter((p) => p.blocks.length === 0);
  checks.push(
    emptyPages.length
      ? {
          ok: false,
          text: `${plural(emptyPages.length, 'page')} with nothing on it`,
          pages: named(emptyPages),
        }
      : {
          ok: true,
          text: `${plural(doc.pages.length, 'page')}, ${plural(blocks.length, 'block')}`,
        },
  );

  const unfilled = unfilledBlock;
  const missing = blocks.filter(unfilled);
  if (missing.length)
    checks.push({
      ok: false,
      text: `${plural(missing.length, 'media block')} without a file or link`,
      pages: named(
        doc.pages.filter((p) => p.blocks.some(unfilled)),
        (p) => p.blocks.find(unfilled)?.id,
      ),
    });

  const notes = doc.pages.filter((p) => p.notes?.length);
  if (notes.length)
    checks.push({
      ok: false,
      text: 'Review notes still open',
      pages: named(notes),
    });

  const pageIds = new Set(doc.pages.map((p) => p.id));
  const actionsOn = (p: Page): (Action | ButtonAction)[] => [
    ...p.triggers.map((t) => t.action),
    ...p.blocks.flatMap((b) => (b.type === 'button' ? [b.action] : [])),
  ];
  const dead = deadActionTest(doc);
  const deadLinks = doc.pages.flatMap(actionsOn).filter(dead);
  const deadBlock = (p: Page) =>
    p.blocks.find((b) => b.type === 'button' && dead(b.action))?.id ??
    p.triggers.flatMap((t) => (t.when.kind === 'click' && dead(t.action) ? [t.when.blockId] : []))[0];
  const stuck = doc.pages.filter((p) => stuckPage(doc, p));
  if (stuck.length)
    checks.push({
      ok: false,
      text: 'No way to leave these pages. Add a button or trigger that goes somewhere, or turn on the Back and Continue bar in course settings.',
      pages: named(stuck),
    });

  const unsetPath = (b: Block) =>
    b.type === 'pathway' && b.choices.some((c) => !pageIds.has(c.pageId));
  const unsetPaths = blocks.filter(unsetPath);
  if (unsetPaths.length)
    checks.push({
      ok: false,
      text: `${plural(unsetPaths.length, 'pathway choice')} block with a choice that goes nowhere`,
      pages: named(
        doc.pages.filter((p) => p.blocks.some(unsetPath)),
        (p) => p.blocks.find(unsetPath)?.id,
      ),
    });
  if (deadLinks.length)
    checks.push({
      ok: false,
      text: `${plural(deadLinks.length, 'click action')} going to a page, pop-up or object that no longer exists`,
      pages: named(
        doc.pages.filter((p) => actionsOn(p).some(dead)),
        deadBlock,
      ),
    });

  for (const layout of layoutsFor(doc.screens)) {
    const unset = doc.pages.filter((p) => p.blocks.some((b) => !b.frames?.[layout]));
    if (unset.length)
      checks.push({
        ok: false,
        text: `${layout === 'phone' ? 'Phone' : 'Desktop'} layout not set up`,
        pages: named(unset, (p) => p.blocks.find((b) => !b.frames?.[layout])?.id, layout),
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

function manifest(title: string, id: string, build: number): string {
  const t = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.panwarhealth.course-${id}" version="${build}"
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

export async function packageFiles(
  courseId: string,
  doc: CourseDoc,
  build: number,
  download: (url: string) => Promise<Blob>,
  onProgress: (text: string) => void,
): Promise<{ files: PackageFile[]; mediaBytes: number }> {
  const files: PackageFile[] = [];

  const player = (await (await fetch('/scorm-player/files.json')).json()) as string[];
  for (const f of player) {
    const res = await fetch(`/scorm-player/${f}`);
    if (!res.ok) throw new Error(`The course player is missing ${f}`);
    files.push({ path: f, blob: await res.blob() });
  }

  onProgress('Bundling fonts');
  files.push({ path: 'fonts.css', blob: new Blob([await bundleFonts(files)]) });

  let json = JSON.stringify({ ...doc, build });
  let mediaBytes = 0;
  const urls = mediaUrls(doc);
  for (const [i, url] of urls.entries()) {
    onProgress(`Bundling media ${i + 1} of ${urls.length}`);
    const blob = await download(url);
    mediaBytes += blob.size;
    if (mediaBytes > MAX_MEDIA_BYTES) throw new Error('Media is over 100 MB. Use smaller videos.');
    const name = `media/${url.split('/').pop()}`;
    files.push({ path: name, blob });
    json = json.split(url).join(name);
  }

  files.push({ path: 'course.json', blob: new Blob([json]) });
  files.push({ path: 'imsmanifest.xml', blob: new Blob([manifest(doc.title, courseId, build)]) });
  return { files, mediaBytes };
}

export async function buildZip(
  courseId: string,
  doc: CourseDoc,
  build: number,
  download: (url: string) => Promise<Blob>,
  onProgress: (text: string) => void,
): Promise<{ blob: Blob; mediaBytes: number }> {
  const { files, mediaBytes } = await packageFiles(courseId, doc, build, download, onProgress);
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.blob);
  onProgress('Zipping');
  return { blob: await zip.generateAsync({ type: 'blob' }), mediaBytes };
}
