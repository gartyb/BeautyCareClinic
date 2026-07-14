import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ActiveTimerContextValue {
  targetSeriesId: string | null;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  selectSeries: (seriesId: string) => void;
  selectAndStart: (seriesId: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  endAndGetElapsed: () => { seriesId: string; elapsedSeconds: number } | null;
}

const ActiveTimerContext = createContext<ActiveTimerContextValue | null>(null);

export function ActiveTimerProvider({ children }: { children: React.ReactNode }) {
  const [targetSeriesId, setTargetSeriesId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Store interval id in a ref — never in state (avoids extra re-renders)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Single effect keyed on isRunning — starts/stops the interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // selectSeries: blocked when a timer is already active (running or paused)
  const selectSeries = useCallback((seriesId: string) => {
    if (isRunning || isPaused) return;
    setTargetSeriesId(seriesId);
  }, [isRunning, isPaused]);

  // selectAndStart: atomically selects a series and starts the timer in one batch update
  const selectAndStart = useCallback((seriesId: string) => {
    if (isRunning || isPaused) return;
    setTargetSeriesId(seriesId);
    setIsRunning(true);
  }, [isRunning, isPaused]);

  // start: only valid when a series is selected and no timer is active
  const start = useCallback(() => {
    if (targetSeriesId === null || isRunning || isPaused) return;
    setIsRunning(true);
  }, [targetSeriesId, isRunning, isPaused]);

  // pause: stop interval, keep elapsed
  const pause = useCallback(() => {
    if (!isRunning) return;
    setIsRunning(false);
    setIsPaused(true);
  }, [isRunning]);

  // resume: restart interval from current elapsed
  const resume = useCallback(() => {
    if (!isPaused) return;
    setIsPaused(false);
    setIsRunning(true);
  }, [isPaused]);

  // reset: clear everything unconditionally
  const reset = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setTargetSeriesId(null);
  }, []);

  // endAndGetElapsed: atomically snapshot then reset; returns null if no active timer
  const endAndGetElapsed = useCallback((): { seriesId: string; elapsedSeconds: number } | null => {
    if (!targetSeriesId) return null;
    // Capture current elapsed synchronously from state
    // We need to read the current value — use a ref trick won't work cleanly here
    // so we use the functional approach: read directly from the closure snapshot
    // which is safe because this callback is only invoked from user interaction
    // (not from inside setElapsedSeconds), so the closure captures the latest render value.
    const snapshot = {
      seriesId: targetSeriesId,
      elapsedSeconds,
    };
    // Atomically reset all state
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setTargetSeriesId(null);
    return snapshot;
  }, [targetSeriesId, elapsedSeconds]);

  const value: ActiveTimerContextValue = {
    targetSeriesId,
    isRunning,
    isPaused,
    elapsedSeconds,
    selectSeries,
    selectAndStart,
    start,
    pause,
    resume,
    reset,
    endAndGetElapsed,
  };

  return <ActiveTimerContext.Provider value={value}>{children}</ActiveTimerContext.Provider>;
}

export function useActiveTimer(): ActiveTimerContextValue {
  const ctx = useContext(ActiveTimerContext);
  if (!ctx) throw new Error('useActiveTimer must be used within ActiveTimerProvider');
  return ctx;
}
