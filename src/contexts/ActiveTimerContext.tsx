import React, { createContext, useContext, useMemo } from 'react';

interface ActiveTimerContextValue {
  targetSeriesId: string | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  // All no-ops in Phase 1
  selectSeries: (seriesId: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

const noop = () => {};
const noopStr = (_seriesId: string) => {};

const ActiveTimerContext = createContext<ActiveTimerContextValue | null>(null);

export function ActiveTimerProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ActiveTimerContextValue>(
    () => ({
      targetSeriesId: null,
      isRunning: false,
      isPaused: false,
      elapsedSeconds: 0,
      selectSeries: noopStr,
      start: noop,
      pause: noop,
      resume: noop,
      reset: noop,
    }),
    []
  );

  return <ActiveTimerContext.Provider value={value}>{children}</ActiveTimerContext.Provider>;
}

export function useActiveTimer(): ActiveTimerContextValue {
  const ctx = useContext(ActiveTimerContext);
  if (!ctx) throw new Error('useActiveTimer must be used within ActiveTimerProvider');
  return ctx;
}
