import QRCode from 'qrcode';
import type { QrCodeOptions } from '@/api/links';

const QUIET_ZONE = 4;
const LOGO_SHARE = 0.24;

export function buildQrSvg(text: string, options: QrCodeOptions, logo: string | null): string {
  const showLogo = options.hasLogo && logo !== null;
  const { modules } = QRCode.create(text, { errorCorrectionLevel: options.hasLogo ? 'H' : 'M' });
  const count = modules.size;
  const total = count + QUIET_ZONE * 2;

  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (modules.data[row * count + col]) {
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }

  let logoMarkup = '';
  if (showLogo) {
    const side = Math.round(count * LOGO_SHARE);
    const at = (total - side) / 2;
    logoMarkup =
      `<rect x="${at - 1}" y="${at - 1}" width="${side + 2}" height="${side + 2}" fill="${options.background}"/>` +
      `<image x="${at}" y="${at}" width="${side}" height="${side}" href="${logo}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" viewBox="0 0 ${total} ${total}">` +
    `<rect width="${total}" height="${total}" fill="${options.background}"/>` +
    `<path d="${path}" fill="${options.foreground}" shape-rendering="crispEdges"/>` +
    logoMarkup +
    `</svg>`
  );
}

export const svgDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export async function loadLogo(): Promise<string> {
  const response = await fetch('/favicon-192x192.png');
  if (!response.ok) throw new Error('Logo failed to load');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function downloadSvg(svg: string, filename: string) {
  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
}

export async function downloadPng(svg: string, size: number, filename: string) {
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, size, size);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  saveBlob(blob, filename);
}

export function qrFilename(url: string): string {
  try {
    const parsed = new URL(url);
    return `qr-${parsed.searchParams.get('utm_campaign') ?? parsed.hostname}`;
  } catch {
    return 'qr';
  }
}
