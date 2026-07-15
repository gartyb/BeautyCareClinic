import { useState } from 'react';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { updateDefaultMaxPaymentCount } from './settingsService';
import { DomainError } from '../../domain/errors';

export function SettingsScreen() {
  const { defaultMaxPaymentCount, setDefaultMaxPaymentCount } = useGlobalSettings();
  const [inputValue, setInputValue] = useState<string>(defaultMaxPaymentCount.toString());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSave() {
    setSuccessMessage(null);
    setErrorMessage(null);
    const parsed = parseInt(inputValue, 10);
    try {
      const validated = updateDefaultMaxPaymentCount(parsed);
      setDefaultMaxPaymentCount(validated);
      setSuccessMessage('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      if (e instanceof DomainError) {
        setErrorMessage(e.message);
      } else {
        setErrorMessage('שגיאה לא צפויה');
      }
    }
  }

  const parsed = parseInt(inputValue, 10);
  const isValid = !Number.isNaN(parsed) && parsed > 0 && parsed <= 24;

  return (
    <div className="flex-1 bg-clinic-bg p-6">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-clinic-text mb-6">הגדרות</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-clinic-text mb-4">הגדרות תשלומים</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">
                מספר תשלומים מקסימלי ברירת מחדל
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value);
                  setSuccessMessage(null);
                  setErrorMessage(null);
                }}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-clinic-gold"
                dir="ltr"
              />
            </div>

            {errorMessage && (
              <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                {successMessage}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!isValid}
              className="bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              שמור הגדרות
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
