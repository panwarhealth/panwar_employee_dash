import type { CSSProperties } from 'react';
import type { CourseDoc } from './doc';

export const accentStyle = (doc: CourseDoc) => ({ '--cp-accent': doc.accent }) as CSSProperties;

export function embedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
  if (host === 'youtube.com' && url.searchParams.get('v'))
    return `https://www.youtube.com/embed/${url.searchParams.get('v')}`;
  if (host === 'vimeo.com' && /^\/\d+/.test(url.pathname))
    return `https://player.vimeo.com/video${url.pathname}`;
  return url.toString();
}

export function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
