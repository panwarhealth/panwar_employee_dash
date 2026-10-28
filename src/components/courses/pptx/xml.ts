import type JSZip from 'jszip';

export const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const EMU_PER_PT = 12700;

export type Rels = Record<string, { type: string; target: string; external: boolean }>;

export interface Part {
  path: string;
  xml: Document;
  rels: Rels;
}

export const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

export const child = (el: Element | undefined | null, ns: string, name: string) =>
  el
    ? Array.from(el.children).find((c) => c.namespaceURI === ns && c.localName === name)
    : undefined;

export const num = (el: Element | undefined, attr: string) => Number(el?.getAttribute(attr) ?? 0);

function resolvePath(base: string, target: string): string {
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

export async function readRels(zip: JSZip, part: string): Promise<Rels> {
  const file = zip.file(part.replace(/([^/]+)$/, '_rels/$1.rels'));
  const rels: Rels = {};
  if (!file) return rels;
  for (const r of Array.from(parseXml(await file.async('string')).getElementsByTagName('*'))) {
    if (r.localName !== 'Relationship') continue;
    const external = r.getAttribute('TargetMode') === 'External';
    const target = r.getAttribute('Target') ?? '';
    rels[r.getAttribute('Id') ?? ''] = {
      type: r.getAttribute('Type') ?? '',
      target: external ? target : resolvePath(part, target),
      external,
    };
  }
  return rels;
}

export async function readPart(zip: JSZip, path: string): Promise<Part | undefined> {
  const file = zip.file(path);
  if (!file) return undefined;
  return { path, xml: parseXml(await file.async('string')), rels: await readRels(zip, path) };
}

export const relOf = (part: Part, type: string) =>
  Object.values(part.rels).find((r) => r.type.endsWith(`/${type}`));

export function externalLink(owner: Part, el: Element | undefined): string | undefined {
  const id = el?.getAttributeNS(R, 'id');
  const rel = id ? owner.rels[id] : undefined;
  return rel?.external ? rel.target : undefined;
}

export function paragraphsText(el: Element): string {
  return Array.from(el.getElementsByTagNameNS(A, 'p'))
    .map((p) =>
      Array.from(p.getElementsByTagNameNS(A, 't'))
        .map((t) => t.textContent ?? '')
        .join(''),
    )
    .filter((t) => t.trim())
    .join('\n');
}
