type NativeDropper = new () => { open(): Promise<{ sRGBHex: string }> };

const FRAME_WAIT_MS = 300;

const hex = (n: number) => n.toString(16).padStart(2, '0');

async function nativePick(Dropper: NativeDropper): Promise<string | undefined> {
  try {
    return (await new Dropper().open()).sRGBHex.toUpperCase();
  } catch {
    return undefined;
  }
}

async function grabScreen(): Promise<HTMLCanvasElement | undefined> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return undefined;
  }
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((done) => setTimeout(done, FRAME_WAIT_MS));
    const shot = document.createElement('canvas');
    shot.width = video.videoWidth;
    shot.height = video.videoHeight;
    shot.getContext('2d')!.drawImage(video, 0, 0);
    return shot;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

function fitted(shot: HTMLCanvasElement) {
  const k = Math.min(1, (innerWidth - 40) / shot.width, (innerHeight - 80) / shot.height);
  const width = shot.width * k;
  const height = shot.height * k;
  return { left: (innerWidth - width) / 2, top: (innerHeight - height + 30) / 2, width, height };
}

function pickFrom(shot: HTMLCanvasElement): Promise<string | undefined> {
  const at = fitted(shot);
  const pixels = shot.getContext('2d', { willReadFrequently: true })!;
  const cover = document.createElement('div');
  cover.style.cssText =
    'position:fixed;inset:0;z-index:9999;cursor:crosshair;background:rgba(20,20,24,.9)';
  Object.assign(shot.style, {
    position: 'fixed',
    left: `${at.left}px`,
    top: `${at.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
  });
  const chip = document.createElement('div');
  chip.style.cssText =
    'position:fixed;display:none;align-items:center;gap:6px;padding:4px 8px 4px 4px;background:#fff;border-radius:6px;font:12px/1 sans-serif;color:#2f3030;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:none';
  const dot = document.createElement('span');
  dot.style.cssText = 'width:20px;height:20px;border-radius:4px;border:1px solid rgba(0,0,0,.2)';
  const label = document.createElement('span');
  chip.append(dot, label);
  const hint = document.createElement('div');
  hint.textContent = 'Click anywhere on the picture to pick a colour. Esc to cancel.';
  hint.style.cssText =
    'position:fixed;left:50%;top:12px;translate:-50% 0;padding:6px 12px;background:#702f8f;color:#fff;border-radius:4px;font:13px/1.4 sans-serif';
  cover.append(shot, chip, hint);
  document.body.appendChild(cover);

  const colourAt = (e: MouseEvent) => {
    const x = Math.floor(((e.clientX - at.left) / at.width) * shot.width);
    const y = Math.floor(((e.clientY - at.top) / at.height) * shot.height);
    if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) return undefined;
    const [r, g, b] = pixels.getImageData(x, y, 1, 1).data;
    return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
  };

  return new Promise((done) => {
    const finish = (colour: string | undefined) => {
      cover.remove();
      window.removeEventListener('keydown', key, true);
      done(colour);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      finish(undefined);
    };
    cover.addEventListener('mousemove', (e) => {
      const colour = colourAt(e);
      chip.style.display = colour ? 'flex' : 'none';
      if (!colour) return;
      Object.assign(chip.style, { left: `${e.clientX + 16}px`, top: `${e.clientY + 16}px` });
      dot.style.background = colour;
      label.textContent = colour;
    });
    cover.addEventListener('click', (e) => finish(colourAt(e)));
    window.addEventListener('keydown', key, true);
  });
}

export async function pickColour(): Promise<string | undefined> {
  const Dropper = (window as { EyeDropper?: NativeDropper }).EyeDropper;
  if (Dropper) return nativePick(Dropper);
  const shot = await grabScreen();
  return shot && pickFrom(shot);
}
