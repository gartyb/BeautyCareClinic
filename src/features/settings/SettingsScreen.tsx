import { useState } from 'react';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { updateDefaultMaxPaymentCount } from './settingsService';
import { DomainError } from '../../domain/errors';

export function SettingsScreen() {
  const { defaultMaxPaymentCount, setDefaultMaxPaymentCount, calendarStartHour, calendarEndHour, setCalendarHours } = useGlobalSettings();
  const [inputValue, setInputValue] = useState<string>(defaultMaxPaymentCount.toString());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [startHourStr, setStartHourStr] = useState<string>(calendarStartHour.toString());
  const [endHourStr, setEndHourStr] = useState<string>(calendarEndHour.toString());
  const [calendarSuccess, setCalendarSuccess] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  function handleSaveCalendarHours() {
    setCalendarSuccess(null);
    setCalendarError(null);
    const start = parseInt(startHourStr, 10);
    const end = parseInt(endHourStr, 10);
    if (!Number.isInteger(start) || start < 0 || start > 23) {
      setCalendarError('שעת פתיחה חייבת להיות בין 0 ל-23');
      return;
    }
    if (!Number.isInteger(end) || end < 1 || end > 24) {
      setCalendarError('שעת סיום חייבת להיות בין 1 ל-24');
      return;
    }
    if (start >= end) {
      setCalendarError('שעת הפתיחה חייבת להיות לפני שעת הסיום');
      return;
    }
    setCalendarHours(start, end);
    setCalendarSuccess('ההגדרות נשמרו בהצלחה');
  }

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

        {/* Calendar hours */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-semibold text-clinic-text mb-4">הגדרות לוח זמנים</h2>
          <div className="flex items-end gap-6">
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">שעת פתיחה</label>
              <input
                type="number"
                min={0} max={23}
                value={startHourStr}
                onChange={e => { setStartHourStr(e.target.value); setCalendarError(null); setCalendarSuccess(null); }}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-clinic-gold"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">שעת סיום</label>
              <input
                type="number"
                min={1} max={24}
                value={endHourStr}
                onChange={e => { setEndHourStr(e.target.value); setCalendarError(null); setCalendarSuccess(null); }}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-clinic-gold"
                dir="ltr"
              />
            </div>
            <button
              onClick={handleSaveCalendarHours}
              className="bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium"
            >
              שמור
            </button>
          </div>
          {calendarError && <p className="mt-3 text-sm text-red-500">{calendarError}</p>}
          {calendarSuccess && <p className="mt-3 text-sm text-green-600">{calendarSuccess}</p>}
        </div>

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
