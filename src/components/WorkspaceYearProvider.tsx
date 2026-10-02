import { useCallback, useRef, useState } from 'react';
import { YearContext } from '@/lib/workspaceYear';

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
