import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Self-contained grouped bar chart for education completions (no chart lib).
 * Hand-rolled SVG so we get exact bar geometry — needed to anchor annotation
 * bubbles precisely to the top of a specific bar, and to make bars clickable.
 * Identical component in the client dashboard (read-only there).
 */

export interface ChartSeries {
  id: string;
  label: string;
  color: string | null;
  points: { year: number; month: number; value: number }[];
}
export interface ChartAnnotation {
  id: string;
  seriesId: string;
  year: number;
  month: number;
  text: string;
}

interface Props {
  series: ChartSeries[];
  annotations: ChartAnnotation[];
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  onBarClick?: (seriesId: string, year: number, month: number) => void;
  onAnnotationClick?: (annotationId: string) => void;
  height?: number;
}

export const PALETTE = [
  '#d62728', '#ff7f0e', '#1f77b4', '#2ca02c', '#111111',
  '#9467bd', '#8c564b', '#e377c2', '#17becf', '#bcbd22',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ord = (y: number, m: number) => y * 12 + (m - 1);
const parseYm = (ym: string): [number, number] => {
  const [y, m] = ym.split('-').map(Number);
  return [y, m];
};

function monthList(from: string, to: string): { year: number; month: number }[] {
  const [fy, fm] = parseYm(from);
  const [ty, tm] = parseYm(to);
  const out: { year: number; month: number }[] = [];
  for (let o = ord(fy, fm); o <= ord(ty, tm); o++) {
    out.push({ year: Math.floor(o / 12), month: (o % 12) + 1 });
  }
  return out;
}

function niceMax(raw: number): number {
  if (raw <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const s of steps) {
    if (s * pow >= raw) return s * pow;
  }
  return 10 * pow;
}

export function EducationBarChart({
  series,
  annotations,
  from,
  to,
  onBarClick,
  onAnnotationClick,
  height = 360,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const months = monthList(from, to);
  const colorOf = (s: ChartSeries, i: number) => s.color ?? PALETTE[i % PALETTE.length];

  // Value lookup: `${seriesId}:${ord}` -> value
  const valueAt = new Map<string, number>();
  series.forEach((s) => {
    s.points.forEach((p) => valueAt.set(`${s.id}:${ord(p.year, p.month)}`, p.value));
  });

  // Scale the axis to the displayed window only - series may carry points
  // outside it (the admin tree is unwindowed).
  const inWindow = new Set(months.map((m) => ord(m.year, m.month)));
  let maxRaw = 1;
  series.forEach((s) =>
    s.points.forEach((p) => {
      if (inWindow.has(ord(p.year, p.month))) maxRaw = Math.max(maxRaw, p.value);
    }),
  );
  const yMax = niceMax(maxRaw);

  // Plot geometry (pixels).
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = Math.max(0, height - padT - padB);
  const x0 = padL;
  const y1 = padT + plotH; // baseline
  const groupW = months.length > 0 ? plotW / months.length : plotW;
  const groupInner = groupW * 0.82;
  const groupPad = (groupW - groupInner) / 2;
  const barW = series.length > 0 ? groupInner / series.length : groupInner;
  const yScale = (v: number) => padT + plotH - (Math.max(0, v) / yMax) * plotH;

  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (yMax / ticks) * i);

  // Resolve a bar's centre-x and top-y for annotation anchoring.
  const barAnchor = (seriesId: string, year: number, month: number) => {
    const gi = months.findIndex((m) => m.year === year && m.month === month);
    const si = series.findIndex((s) => s.id === seriesId);
    if (gi < 0 || si < 0) return null;
    const v = valueAt.get(`${seriesId}:${ord(year, month)}`) ?? 0;
    const cx = x0 + gi * groupW + groupPad + si * barW + barW / 2;
    const topY = yScale(v);
    return { cx, topY };
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg width={width} height={height} className="block">
        {/* Y gridlines + labels */}
        {tickVals.map((tv, i) => {
          const y = yScale(tv);
          return (
            <g key={i}>
              <line x1={x0} y1={y} x2={width - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={x0 - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#9ca3af">
                {formatTick(tv)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {months.map((m, gi) =>
          series.map((s, si) => {
            const v = valueAt.get(`${s.id}:${ord(m.year, m.month)}`);
            if (v === undefined || v <= 0) return null;
            const bx = x0 + gi * groupW + groupPad + si * barW;
            const by = yScale(v);
            const bh = y1 - by;
            return (
              <rect
                key={`${s.id}:${gi}`}
                x={bx}
                y={by}
                width={Math.max(1, barW - 1)}
                height={bh}
                fill={colorOf(s, si)}
                className={onBarClick ? 'cursor-pointer hover:opacity-80' : undefined}
                onClick={onBarClick ? () => onBarClick(s.id, m.year, m.month) : undefined}
              >
                <title>{`${s.label} — ${MONTHS[m.month - 1]} ${m.year}: ${Math.round(v).toLocaleString()}`}</title>
              </rect>
            );
          }),
        )}

        {/* X axis month labels */}
        {months.map((m, gi) => {
          const cx = x0 + gi * groupW + groupW / 2;
          return (
            <text key={gi} x={cx} y={y1 + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
              {`${MONTHS[m.month - 1]}-${String(m.year).slice(2)}`}
            </text>
          );
        })}

        {/* Leader lines for annotation bubbles */}
        {annotations.map((a) => {
          const anc = barAnchor(a.seriesId, a.year, a.month);
          if (!anc) return null;
          const bubbleBottom = Math.max(14, anc.topY - 10);
          return (
            <line
              key={`lead-${a.id}`}
              x1={anc.cx}
              y1={anc.topY}
              x2={anc.cx}
              y2={bubbleBottom}
              stroke="#9ca3af"
              strokeWidth={1}
            />
          );
        })}
      </svg>

      {/* Annotation bubbles (HTML overlay for crisp wrapped text) */}
      {annotations.map((a) => {
        const anc = barAnchor(a.seriesId, a.year, a.month);
        if (!anc) return null;
        const bubbleBottom = Math.max(14, anc.topY - 10);
        return (
          <div
            key={a.id}
            className={
              'absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-ph-charcoal/15 bg-white px-2 py-1 text-[10px] leading-tight text-ph-charcoal shadow-sm ' +
              (onAnnotationClick ? 'cursor-pointer hover:border-ph-purple' : '')
            }
            style={{ left: anc.cx, top: bubbleBottom, maxWidth: 150 }}
            onClick={onAnnotationClick ? () => onAnnotationClick(a.id) : undefined}
          >
            {a.text}
          </div>
        );
      })}
    </div>
  );
}

function formatTick(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  return String(Math.round(v));
}

/** Vertical legend (long module titles), as in the workbook. */
export function EducationLegend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="flex flex-col gap-1 text-xs text-ph-charcoal/80">
      {series.map((s, i) => (
        <li key={s.id} className="flex items-start gap-2">
          <span
            className="mt-0.5 h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: s.color ?? PALETTE[i % PALETTE.length] }}
          />
          <span className="leading-tight">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}
