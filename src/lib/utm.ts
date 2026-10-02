export interface Choice {
  value: string;
  label: string;
}

export const SOURCES: Choice[] = [
  { value: 'ajp', label: 'AJP' },
  { value: 'australian-pharmacist', label: 'Australian Pharmacist' },
  { value: 'pharmacy-club', label: 'Pharmacy Club' },
  { value: 'healthed', label: 'Healthed' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'panwar-health', label: 'Panwar Health' },
];

export const MEDIUMS: Choice[] = [
  { value: 'email', label: 'Email' },
  { value: 'qr', label: 'QR code' },
  { value: 'social', label: 'Social post' },
  { value: 'banner', label: 'Banner' },
  { value: 'article', label: 'Sponsored article' },
  { value: 'print', label: 'Print' },
  { value: 'sms', label: 'SMS' },
];

export const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const jobPrefix = (slug: string): string | null =>
  /^([a-z]{2,5})\d{4,5}$/.exec(slug)?.[1].toUpperCase() ?? null;

export function parseWebAddress(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export const hasUtmParams = (url: URL): boolean =>
  [...url.searchParams.keys()].some((k) => k.toLowerCase().startsWith('utm_'));

export function withChoicesUsed(base: Choice[], used: string[]): Choice[] {
  const known = new Set(base.map((c) => c.value));
  const extra = [...new Set(used)].filter((v) => !known.has(v)).sort();
  return [...base, ...extra.map((v) => ({ value: v, label: v }))];
}

export const formatDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
