import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * The workspace-wide reporting year. One state shared by every client-tab's
 * YearPicker, so switching Placements → KPI Targets keeps the year. Lives in
 * its own module (not the route file) so fast-refresh never duplicates the
 * context instance.
 *
 * setYear is the user's explicit choice; initYear is a data-driven default
 * ("latest year with placements") that only applies until anything else has
 * set the year - so tab switches never stomp a chosen year.
 */
const YearContext = createContext<{
  year: number;
  setYear: (year: number) => void;
  initYear: (year: number) => void;
  yearsWithData: number[];
  publishYears: (years: number[]) => void;
} | null>(null);

export function WorkspaceYearProvider({ children }: { children: React.ReactNode }) {
  const [year, setYearState] = useState(() => new Date().getFullYear());
  const [yearsWithData, setYearsWithData] = useState<number[]>([]);
  const initialised = useRef(false);
  const setYear = useCallback((y: number) => {
    initialised.current = true;
    setYearState(y);
  }, []);
  const initYear = useCallback((y: number) => {
    if (initialised.current) return;
    initialised.current = true;
    setYearState(y);
  }, []);
  const publishYears = useCallback((years: number[]) => {
    setYearsWithData((prev) =>
      prev.length === years.length && prev.every((y, i) => y === years[i]) ? prev : years,
    );
  }, []);
  return (
    <YearContext.Provider value={{ year, setYear, initYear, yearsWithData, publishYears }}>
      {children}
    </YearContext.Provider>
  );
}

export function useWorkspaceYear() {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useWorkspaceYear must be used within WorkspaceYearProvider');
  return ctx;
}

/**
 * Called by year-scoped tabs to feed the workspace YearPicker its "years with
 * data" options. The active tab's list wins; undefined (still loading) leaves
 * the previous list in place rather than flashing empty.
 */
export function usePublishYears(years: number[] | undefined) {
  const { publishYears } = useWorkspaceYear();
  useEffect(() => {
    if (years) publishYears(years);
  }, [years, publishYears]);
}
