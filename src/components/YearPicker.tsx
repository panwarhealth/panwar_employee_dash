import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Year picker for the data-entry tabs (Placements actuals, Education completions).
 * Options never depend on what data exists - admins enter everything through
 * the UI, so the first entry for a year must never require that year to
 * already have data (chicken-and-egg). The chevrons step one year at a time
 * with no upper bound; the floor is 2023.
 */
// Earliest year of client media history (the Reckitt workbook starts 2023).
const FLOOR_YEAR = 2023;

export function YearPicker({
  year,
  onChange,
  label = 'Year',
}: {
  year: number;
  onChange: (year: number) => void;
  label?: string;
}) {
  // Dropdown is a sliding window around the selected year (a few back, one
  // forward), floored at FLOOR_YEAR. Stepping or picking re-centres it, so
  // any year is reachable without the list ever growing unbounded.
  const min = Math.max(FLOOR_YEAR, year - 3);
  const max = year + 1;
  const options: number[] = [];
  for (let y = min; y <= max; y++) options.push(y);

  const stepBtn =
    'flex h-9 w-7 items-center justify-center rounded-md border border-ph-charcoal/20 bg-white text-ph-charcoal/60 hover:border-ph-purple hover:text-ph-purple disabled:cursor-not-allowed disabled:text-ph-charcoal/20 disabled:hover:border-ph-charcoal/20';

  return (
    <span className="flex items-center gap-2 text-xs font-medium text-ph-charcoal/70">
      {label}
      <span className="flex items-center gap-1">
        <button
          type="button"
          className={stepBtn}
          disabled={year <= FLOOR_YEAR}
          onClick={() => onChange(year - 1)}
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <select
          value={year}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 rounded-md border border-ph-charcoal/20 bg-white px-2 text-sm font-semibold text-ph-charcoal focus:border-ph-purple focus:outline-none"
        >
          {options.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {/* No ceiling - stepping forward extends the dropdown range as you go. */}
        <button type="button" className={stepBtn} onClick={() => onChange(year + 1)} aria-label="Next year">
          <ChevronRight className="h-4 w-4" />
        </button>
      </span>
    </span>
  );
}
