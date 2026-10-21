import { addDays, fmtDate, todayIso, weekStart } from '@/lib/timesheets';

const LEFT = 40;
const RIGHT = 980;
const TOP = 20;
const BOTTOM = 200;
const MAX_LABELS = 8;
const MAX_DOTS = 30;

export function JobChart({
  weeks,
  budget,
  cumulative,
}: {
  weeks: { weekStart: string; hours: number }[];
  budget: number | null;
  cumulative: boolean;
}) {
  if (weeks.length === 0) return <p className="hint">No time tracked yet</p>;

  const last =
    weekStart(todayIso()) > weeks[weeks.length - 1]!.weekStart
      ? weekStart(todayIso())
      : weeks[weeks.length - 1]!.weekStart;
  const series: { start: string; value: number }[] = [];
  let running = 0;
  for (let w = weeks[0]!.weekStart; w <= last; w = addDays(w, 7)) {
    const hours = weeks.find((x) => x.weekStart === w)?.hours ?? 0;
    running += hours;
    series.push({ start: w, value: cumulative ? running : hours });
  }

  const peak = Math.max(...series.map((s) => s.value), cumulative ? (budget ?? 0) : 0, 1) * 1.1;
  const y = (v: number) => BOTTOM - (v / peak) * (BOTTOM - TOP);
  const step = series.length > 1 ? (RIGHT - LEFT) / (series.length - 1) : 0;
  const x = (i: number) => (series.length > 1 ? LEFT + i * step : (LEFT + RIGHT) / 2);
  const ticks = [0.25, 0.5, 0.75].map((f) => Math.round(peak * f));
  const every = Math.ceil(series.length / MAX_LABELS);
  const barWidth = Math.max(4, Math.min(40, ((RIGHT - LEFT) / series.length) * 0.6));

  return (
    <svg viewBox="0 0 1000 230" className="jc" preserveAspectRatio="none">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={LEFT} x2={RIGHT} y1={y(t)} y2={y(t)} className="gl" />
          <text x={LEFT - 8} y={y(t) + 4} className="ax" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {cumulative && budget !== null && (
        <g>
          <line x1={LEFT} x2={RIGHT} y1={y(budget)} y2={y(budget)} className="bl" />
          <rect x={LEFT} y={y(budget) - 18} width={110} height={16} rx={3} className="blt" />
          <text x={LEFT + 6} y={y(budget) - 6} className="bltx">
            Budget: {budget} hours
          </text>
        </g>
      )}
      {cumulative ? (
        <>
          <polyline
            points={series.map((s, i) => `${x(i)},${y(s.value)}`).join(' ')}
            className="ln"
          />
          {series.length <= MAX_DOTS &&
            series.map((s, i) => (
              <circle key={s.start} cx={x(i)} cy={y(s.value)} r={3.5} className="pt" />
            ))}
        </>
      ) : (
        series.map((s, i) => (
          <rect
            key={s.start}
            x={x(i) - barWidth / 2}
            y={y(s.value)}
            width={barWidth}
            height={BOTTOM - y(s.value)}
            className="bar"
          />
        ))
      )}
      {series.map((s, i) =>
        i % every === 0 ? (
          <text key={s.start} x={x(i)} y={222} className="ax" textAnchor="middle">
            {fmtDate(s.start, { day: 'numeric', month: 'short' })}
          </text>
        ) : null,
      )}
    </svg>
  );
}
