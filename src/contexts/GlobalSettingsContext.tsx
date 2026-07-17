import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSettings, updateSetting as apiUpdateSetting } from '../api/globalSettingsApi';
import { ApiRequestError } from '../api/apiError';

interface GlobalSettingsContextValue {
  defaultMaxPaymentCount: number;
  setDefaultMaxPaymentCount: (n: number) => Promise<void>;
  calendarStartHour: number;
  calendarEndHour: number;
  setCalendarHours: (start: number, end: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Fallback defaults while loading
const DEFAULTS = {
  defaultMaxPaymentCount: 3,
  calendarStartHour: 8,
  calendarEndHour: 20,
};

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null);

export function GlobalSettingsProvider({ children }: { children: React.ReactNode }) {
  const [defaultMaxPaymentCount, setMaxCount] = useState<number>(DEFAULTS.defaultMaxPaymentCount);
  const [calendarStartHour, setCalendarStartHour] = useState<number>(DEFAULTS.calendarStartHour);
  const [calendarEndHour, setCalendarEndHour] = useState<number>(DEFAULTS.calendarEndHour);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      setIsLoading(true);
      setError(null);
      try {
        const settings = await getSettings();
        if (cancelled) return;
        const map = Object.fromEntries(settings.map(s => [s.name, s.value]));
        if (map['default_max_payment_count']) setMaxCount(Number(map['default_max_payment_count']));
        if (map['calendar_start_hour']) setCalendarStartHour(Number(map['calendar_start_hour']));
        if (map['calendar_end_hour']) setCalendarEndHour(Number(map['calendar_end_hour']));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiRequestError ? e.message : 'שגיאה בטעינת הגדרות';
        setError(msg);
        // Keep defaults on error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  const setDefaultMaxPaymentCount = useCallback(async (n: number) => {
    await apiUpdateSetting('default_max_payment_count', String(n));
    setMaxCount(n);
  }, []);

  const setCalendarHours = useCallback(async (start: number, end: number) => {
    await apiUpdateSetting('calendar_start_hour', String(start));
    await apiUpdateSetting('calendar_end_hour', String(end));
    setCalendarStartHour(start);
    setCalendarEndHour(end);
  }, []);

  const value = useMemo<GlobalSettingsContextValue>(
    () => ({ defaultMaxPaymentCount, setDefaultMaxPaymentCount, calendarStartHour, calendarEndHour, setCalendarHours, isLoading, error }),
    [defaultMaxPaymentCount, setDefaultMaxPaymentCount, calendarStartHour, calendarEndHour, setCalendarHours, isLoading, error]
  );

  return <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>;
}

export function useGlobalSettings(): GlobalSettingsContextValue {
  const ctx = useContext(GlobalSettingsContext);
  if (!ctx) throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
  return ctx;
}
