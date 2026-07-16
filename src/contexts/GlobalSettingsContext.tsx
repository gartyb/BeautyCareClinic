import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { initialGlobalSettings } from '../data/globalSettings';

interface GlobalSettingsContextValue {
  defaultMaxPaymentCount: number;
  setDefaultMaxPaymentCount: (n: number) => void;
  calendarStartHour: number;
  calendarEndHour: number;
  setCalendarHours: (start: number, end: number) => void;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null);

export function GlobalSettingsProvider({ children }: { children: React.ReactNode }) {
  const [defaultMaxPaymentCount, setDefaultMaxPaymentCountState] = useState<number>(
    initialGlobalSettings.defaultMaxPaymentCount
  );
  const [calendarStartHour, setCalendarStartHour] = useState<number>(initialGlobalSettings.calendarStartHour);
  const [calendarEndHour, setCalendarEndHour] = useState<number>(initialGlobalSettings.calendarEndHour);

  const setDefaultMaxPaymentCount = useCallback((n: number) => {
    setDefaultMaxPaymentCountState(n);
  }, []);

  const setCalendarHours = useCallback((start: number, end: number) => {
    setCalendarStartHour(start);
    setCalendarEndHour(end);
  }, []);

  const value = useMemo<GlobalSettingsContextValue>(
    () => ({ defaultMaxPaymentCount, setDefaultMaxPaymentCount, calendarStartHour, calendarEndHour, setCalendarHours }),
    [defaultMaxPaymentCount, setDefaultMaxPaymentCount, calendarStartHour, calendarEndHour, setCalendarHours]
  );

  return <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>;
}

export function useGlobalSettings(): GlobalSettingsContextValue {
  const ctx = useContext(GlobalSettingsContext);
  if (!ctx) throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
  return ctx;
}
