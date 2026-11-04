export async function isLightArtwork(blob: Blob): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 48, 48);
    const data = ctx.getImageData(0, 0, 48, 48).data;
    let seen = 0;
    let light = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      seen++;
      if (data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225) light++;
    }
    return seen > 0 && light / seen > 0.9 && seen < 48 * 48 * 0.9;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const MAX_SIDE = 1920;
const SMALL_ENOUGH = 200_000;
const QUALITY = 0.85;

const opaque = (data: Uint8ClampedArray) => {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return false;
  return true;
};

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((done) => canvas.toBlob(done, type, QUALITY));

const EXT: Record<string, string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size <= SMALL_ENOUGH) return file;
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  let blob = await encode(canvas, 'image/webp');
  if (blob?.type !== 'image/webp') {
    const flat = opaque(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    blob = await encode(canvas, flat ? 'image/jpeg' : 'image/png');
  }
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, EXT[blob.type]), { type: blob.type });
}
