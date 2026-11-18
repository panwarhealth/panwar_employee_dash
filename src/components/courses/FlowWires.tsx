import { useLayoutEffect, useRef } from 'react';
import { useStore } from '@xyflow/react';
import { WIRE_LOOK, pointOn, type Curve, type Wire } from './flowGraph';

const PINK = '#e6007e';

function grid(ctx: CanvasRenderingContext2D, step: number, x: number, y: number, w: number, h: number) {
  if (step < 12) return;
  for (let gx = ((x % step) + step) % step; gx < w; gx += step) ctx.fillRect(Math.round(gx), 0, 1, h);
  for (let gy = ((y % step) + step) % step; gy < h; gy += step) ctx.fillRect(0, Math.round(gy), w, 1);
}

export function FlowWires({
  wires,
  curves,
  picked,
  label,
  lit,
}: {
  wires: Wire[];
  curves: Map<string, Curve>;
  picked: string | null;
  label: string;
  lit: Set<string>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const transform = useStore((s) => s.transform);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const [x, y, zoom] = transform;
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(width * ratio);
    const h = Math.round(height * ratio);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(47, 48, 48, 0.04)';
    grid(ctx, 28 * zoom, x, y, width, height);
    grid(ctx, 140 * zoom, x, y, width, height);

    ctx.setTransform(ratio * zoom, 0, 0, ratio * zoom, ratio * x, ratio * y);
    ctx.lineCap = 'round';
    const left = -x / zoom;
    const top = -y / zoom;
    const right = left + width / zoom;
    const bottom = top + height / zoom;
    const thin = 1.2 / zoom;

    const draw = (wire: Wire, on: boolean) => {
      const c = curves.get(wire.id);
      if (!c) return;
      if (
        Math.max(c[0], c[2], c[4], c[6]) < left ||
        Math.min(c[0], c[2], c[4], c[6]) > right ||
        Math.max(c[1], c[7]) < top ||
        Math.min(c[1], c[7]) > bottom
      )
        return;
      const look = WIRE_LOOK[wire.kind];
      const faded = !on && (picked ? true : lit.size > 0 && !lit.has(wire.from) && !lit.has(wire.to));
      const size = Math.max(on ? 4 : look.width, on ? thin * 2 : thin);
      const lead = on || (lit.size > 0 && !faded);
      ctx.globalAlpha = faded ? (picked ? 0.35 : 0.12) : c[6] < c[0] && !lead ? 0.35 : 1;
      ctx.strokeStyle = ctx.fillStyle = on ? PINK : look.colour;
      ctx.lineWidth = size;
      ctx.setLineDash(on ? [] : look.dash);
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6] - 8, c[7]);
      ctx.stroke();
      const tip = 6 + size * 1.5;
      ctx.beginPath();
      ctx.moveTo(c[6] - 2, c[7]);
      ctx.lineTo(c[6] - 2 - tip, c[7] - tip / 2);
      ctx.lineTo(c[6] - 2 - tip, c[7] + tip / 2);
      ctx.closePath();
      ctx.fill();
    };

    for (const wire of wires) if (wire.id !== picked) draw(wire, false);
    const on = wires.find((wire) => wire.id === picked);
    if (on) draw(on, true);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    const c = on && curves.get(on.id);
    if (c && label) {
      const mid = pointOn(c, 0.5);
      const px = 12 / Math.min(1, zoom);
      ctx.font = `600 ${px}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const half = ctx.measureText(label).width / 2 + px * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = PINK;
      ctx.lineWidth = px / 8;
      ctx.beginPath();
      ctx.roundRect(mid.x - half, mid.y - px, half * 2, px * 2, px);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PINK;
      ctx.fillText(label, mid.x, mid.y);
    }
  }, [transform, width, height, wires, curves, picked, label, lit]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height, zIndex: 3 }}
    />
  );
}
