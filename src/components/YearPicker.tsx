/**
 * Year picker for the data-entry tabs (Placements actuals, Education completions).
 * A plain dropdown that scales with the calendar: options run from the earliest
 * year that has data (or the current year) up to next year, so staff can always
 * start entering the upcoming year. No hardcoded year ceiling.
 */
const CURRENT_YEAR = new Date().getFullYear();

export function YearPicker({
  year,
  onChange,
  yearsWithData = [],
  label = 'Year',
}: {
  year: number;
  onChange: (year: number) => void;
  yearsWithData?: number[];
  label?: string;
}) {
  // Continuous range: from the earliest of (current year, any data year, the
  // selected year) up to (latest of those) + 1. Always includes `year` itself.
  const anchors = [CURRENT_YEAR, year, ...yearsWithData];
  const min = Math.min(...anchors);
  const max = Math.max(...anchors) + 1;
  const options: number[] = [];
  for (let y = min; y <= max; y++) options.push(y);

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-ph-charcoal/70">
      {label}
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-md border border-ph-charcoal/20 bg-white px-2 text-sm font-semibold text-ph-charcoal focus:border-ph-purple focus:outline-none"
      >
        {options.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </label>
  );
}
