import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { initialGlobalSettings } from '../data/globalSettings';

interface GlobalSettingsContextValue {
  defaultMaxPaymentCount: number;
  setDefaultMaxPaymentCount: (n: number) => void;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null);

export function GlobalSettingsProvider({ children }: { children: React.ReactNode }) {
  const [defaultMaxPaymentCount, setDefaultMaxPaymentCountState] = useState<number>(
    initialGlobalSettings.defaultMaxPaymentCount
  );

  const setDefaultMaxPaymentCount = useCallback((n: number) => {
    setDefaultMaxPaymentCountState(n);
  }, []);

  const value = useMemo<GlobalSettingsContextValue>(
    () => ({ defaultMaxPaymentCount, setDefaultMaxPaymentCount }),
    [defaultMaxPaymentCount, setDefaultMaxPaymentCount]
  );

  return <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>;
}

export function useGlobalSettings(): GlobalSettingsContextValue {
  const ctx = useContext(GlobalSettingsContext);
  if (!ctx) throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
  return ctx;
}
