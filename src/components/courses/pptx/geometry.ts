import { A, child, num } from './xml';

export interface ShapePath {
  d: string;
  fill: boolean;
  stroke: boolean;
}

const DEG = 60000;
const toRad = (a: number) => ((a / DEG) * Math.PI) / 180;
const toAng = (rad: number) => ((rad * 180) / Math.PI) * DEG;

function builtIns(w: number, h: number): Record<string, number> {
  const ss = Math.min(w, h);
  const vars: Record<string, number> = {
    w,
    h,
    l: 0,
    t: 0,
    r: w,
    b: h,
    hc: w / 2,
    vc: h / 2,
    ss,
    ls: Math.max(w, h),
    cd2: 10800000,
    cd4: 5400000,
    cd8: 2700000,
    '3cd4': 16200000,
    '3cd8': 8100000,
    '5cd8': 13500000,
    '7cd8': 18900000,
  };
  for (const n of [2, 3, 4, 5, 6, 8, 10, 12, 16, 32]) {
    vars[`wd${n}`] = w / n;
    vars[`hd${n}`] = h / n;
    vars[`ssd${n}`] = ss / n;
  }
  return vars;
}

function evaluate(fmla: string, vars: Record<string, number>): number {
  const [op, ...args] = fmla.trim().split(/\s+/);
  const [x, y, z] = args.map((a) => (a in vars ? vars[a] : Number(a)));
  switch (op) {
    case 'val':
      return x;
    case '*/':
      return (x * y) / z;
    case '+-':
      return x + y - z;
    case '+/':
      return (x + y) / z;
    case '?:':
      return x > 0 ? y : z;
    case 'abs':
      return Math.abs(x);
    case 'at2':
      return toAng(Math.atan2(y, x));
    case 'cat2':
      return x * Math.cos(Math.atan2(z, y));
    case 'sat2':
      return x * Math.sin(Math.atan2(z, y));
    case 'cos':
      return x * Math.cos(toRad(y));
    case 'sin':
      return x * Math.sin(toRad(y));
    case 'tan':
      return x * Math.tan(toRad(y));
    case 'max':
      return Math.max(x, y);
    case 'min':
      return Math.min(x, y);
    case 'mod':
      return Math.sqrt(x * x + y * y + z * z);
    case 'pin':
      return y < x ? x : y > z ? z : y;
    case 'sqrt':
      return Math.sqrt(x);
    default:
      return 0;
  }
}

function guides(
  vars: Record<string, number>,
  defaults: Element | undefined,
  overrides: Element | undefined,
  list: Element | undefined,
) {
  const set = (gd: Element) => {
    vars[gd.getAttribute('name') ?? ''] = evaluate(gd.getAttribute('fmla') ?? 'val 0', vars);
  };
  for (const gd of Array.from(defaults?.children ?? [])) set(gd);
  for (const gd of Array.from(overrides?.children ?? [])) set(gd);
  for (const gd of Array.from(list?.children ?? [])) set(gd);
}

const ellipsePoint = (wR: number, hR: number, ang: number) => {
  const t = Math.atan2(wR * Math.sin(toRad(ang)), hR * Math.cos(toRad(ang)));
  return { x: wR * Math.cos(t), y: hR * Math.sin(t) };
};

export function shapePaths(
  geometry: Element,
  overrides: Element | undefined,
  width: number,
  height: number,
): ShapePath[] {
  const vars = builtIns(width, height);
  guides(vars, child(geometry, A, 'avLst'), overrides, child(geometry, A, 'gdLst'));
  const value = (s: string | null) => (s && s in vars ? vars[s] : Number(s ?? 0));
  const out: ShapePath[] = [];
  for (const path of Array.from(child(geometry, A, 'pathLst')?.children ?? [])) {
    const sx = num(path, 'w') ? width / num(path, 'w') : 1;
    const sy = num(path, 'h') ? height / num(path, 'h') : 1;
    const pt = (el: Element) => ({
      x: value(el.getAttribute('x')) * sx,
      y: value(el.getAttribute('y')) * sy,
    });
    const parts: string[] = [];
    let at = { x: 0, y: 0 };
    for (const cmd of Array.from(path.children)) {
      const pts = Array.from(cmd.children)
        .filter((c) => c.localName === 'pt')
        .map(pt);
      if (cmd.localName === 'moveTo') {
        at = pts[0];
        parts.push(`M${at.x} ${at.y}`);
      } else if (cmd.localName === 'lnTo') {
        at = pts[0];
        parts.push(`L${at.x} ${at.y}`);
      } else if (cmd.localName === 'cubicBezTo') {
        at = pts[2];
        parts.push(`C${pts.map((p) => `${p.x} ${p.y}`).join(' ')}`);
      } else if (cmd.localName === 'quadBezTo') {
        at = pts[1];
        parts.push(`Q${pts.map((p) => `${p.x} ${p.y}`).join(' ')}`);
      } else if (cmd.localName === 'arcTo') {
        const wR = value(cmd.getAttribute('wR')) * sx;
        const hR = value(cmd.getAttribute('hR')) * sy;
        const start = value(cmd.getAttribute('stAng'));
        const swing = value(cmd.getAttribute('swAng'));
        const s = ellipsePoint(wR, hR, start);
        const centre = { x: at.x - s.x, y: at.y - s.y };
        const steps = Math.abs(swing) >= 21600000 ? 2 : 1;
        for (let i = 1; i <= steps; i++) {
          const e = ellipsePoint(wR, hR, start + (swing * i) / steps);
          at = { x: centre.x + e.x, y: centre.y + e.y };
          const large = Math.abs(swing / steps) > 10800000 ? 1 : 0;
          parts.push(`A${wR} ${hR} 0 ${large} ${swing > 0 ? 1 : 0} ${at.x} ${at.y}`);
        }
      } else if (cmd.localName === 'close') {
        parts.push('Z');
      }
    }
    out.push({
      d: parts.join(' '),
      fill: path.getAttribute('fill') !== 'none',
      stroke: !['0', 'false'].includes(path.getAttribute('stroke') ?? ''),
    });
  }
  return out;
}

export function drawingSvg(
  paths: ShapePath[],
  size: { w: number; h: number },
  paint: { fill?: string; stroke?: string; strokeWidth: number; flipH: boolean; flipV: boolean },
): string {
  const pad = paint.stroke ? paint.strokeWidth : 0;
  const flip =
    paint.flipH || paint.flipV
      ? ` transform="translate(${paint.flipH ? size.w : 0} ${paint.flipV ? size.h : 0}) scale(${paint.flipH ? -1 : 1} ${paint.flipV ? -1 : 1})"`
      : '';
  const body = paths
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill && paint.fill ? paint.fill : 'none'}"${
          p.stroke && paint.stroke
            ? ` stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}" stroke-linejoin="round"`
            : ''
        }/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${size.w + 2 * pad} ${size.h + 2 * pad}" preserveAspectRatio="none"><g${flip}>${body}</g></svg>`;
}
