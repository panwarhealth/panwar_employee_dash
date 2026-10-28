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
