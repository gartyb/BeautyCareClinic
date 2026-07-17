import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Trash2, Plus } from 'lucide-react';
import { DomainError } from '../../domain/errors';
import { useTherapists } from '../../contexts/TherapistsContext';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import { parsePhone, formatPhone } from '../../utils/phone';
import type { TherapistWorkingHours } from '../../types/Therapist';
import { updateTherapistWorkingHours } from './therapistDataService';
import { useTherapistData } from '../../contexts/TherapistDataContext';

const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface DayRow {
  weekday: number;
  startTime: string;
  endTime: string;
  isDayOff: boolean;
}

function buildDefaultDayRows(userId: string, hours: TherapistWorkingHours[]): DayRow[] {
  return WEEKDAY_NAMES.map((_, weekday) => {
    const existing = hours.find(h => h.userId === userId && h.weekday === weekday);
    if (existing) {
      return {
        weekday,
        startTime: existing.startTime ?? '',
        endTime: existing.endTime ?? '',
        isDayOff: existing.startTime === null && existing.endTime === null,
      };
    }
    return { weekday, startTime: '', endTime: '', isDayOff: true };
  });
}

export function TherapistDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const {
    workingHours,
    unavailableDates,
    capabilities,
    saveTherapistWorkingHours,
    addTherapistUnavailableDate,
    removeTherapistUnavailableDate,
    saveTherapistCapabilities,
  } = useTherapistData();

  const { treatmentTypes } = useTreatmentTypes();
  const { therapists, updateTherapist } = useTherapists();
  const therapist = therapists.find(u => u.id === userId);

  const [dayRows, setDayRows] = useState<DayRow[]>([]);
  const [newDate, setNewDate] = useState('');
  const [hoursSuccess, setHoursSuccess] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [capsSuccess, setCapsSuccess] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const hoursSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capsSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed dayRows and contact fields once per therapist navigation.
  useEffect(() => {
    if (userId && therapist) {
      setDayRows(buildDefaultDayRows(userId, workingHours));
      setContactPhone(therapist.phone ?? '');
      setContactEmail(therapist.email);
      setContactError(null);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up success timers on unmount to prevent setState on unmounted component.
  useEffect(() => {
    return () => {
      if (hoursSuccessTimer.current) clearTimeout(hoursSuccessTimer.current);
      if (capsSuccessTimer.current) clearTimeout(capsSuccessTimer.current);
      if (contactSuccessTimer.current) clearTimeout(contactSuccessTimer.current);
    };
  }, []);

  if (!therapist) {
    return (
      <div className="flex-1 bg-clinic-bg p-6">
        <p className="text-clinic-muted">מטפלת לא נמצאה</p>
      </div>
    );
  }

  function handleSaveContact() {
    setContactError(null);
    try {
      updateTherapist(userId!, contactPhone, contactEmail);
      setContactSuccess(true);
      if (contactSuccessTimer.current) clearTimeout(contactSuccessTimer.current);
      contactSuccessTimer.current = setTimeout(() => setContactSuccess(false), 2000);
    } catch (e) {
      setContactError(e instanceof DomainError ? e.message : 'שגיאה לא צפויה');
    }
  }

  function updateDayRow(weekday: number, field: keyof DayRow, value: string | boolean) {
    setDayRows(prev =>
      prev.map(r => r.weekday === weekday ? { ...r, [field]: value } : r)
    );
  }

  function handleSaveHours() {
    setHoursError(null);
    const hoursInput = dayRows.map(r => ({
      weekday: r.weekday,
      startTime: r.isDayOff ? null : (r.startTime || null),
      endTime: r.isDayOff ? null : (r.endTime || null),
    }));
    try {
      const updated = updateTherapistWorkingHours(userId!, hoursInput, workingHours);
      saveTherapistWorkingHours(userId!, updated.filter(h => h.userId === userId));
      setHoursSuccess(true);
      if (hoursSuccessTimer.current) clearTimeout(hoursSuccessTimer.current);
      hoursSuccessTimer.current = setTimeout(() => setHoursSuccess(false), 2000);
    } catch (e) {
      if (e instanceof DomainError) {
        setHoursError(e.message);
      } else {
        setHoursError('שגיאה לא צפויה');
      }
    }
  }

  function handleAddDate() {
    if (!newDate) return;
    addTherapistUnavailableDate({ id: '', userId: userId!, date: newDate });
    setNewDate('');
  }

  function handleRemoveDate(date: string) {
    removeTherapistUnavailableDate(userId!, date);
  }

  const userDates = unavailableDates.filter(d => d.userId === userId).sort((a, b) => a.date.localeCompare(b.date));

  const userCapabilityIds = capabilities
    .filter(c => c.userId === userId)
    .map(c => c.treatmentTypeId);

  function toggleCapability(ttId: string) {
    const next = userCapabilityIds.includes(ttId)
      ? userCapabilityIds.filter(id => id !== ttId)
      : [...userCapabilityIds, ttId];
    const updatedCaps = next.map(treatmentTypeId => ({ id: '', userId: userId!, treatmentTypeId }));
    saveTherapistCapabilities(userId!, updatedCaps);
    setCapsSuccess(true);
    if (capsSuccessTimer.current) clearTimeout(capsSuccessTimer.current);
    capsSuccessTimer.current = setTimeout(() => setCapsSuccess(false), 2000);
  }

  return (
    <div className="flex-1 bg-clinic-bg p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate('/therapists')}
            className="text-clinic-muted hover:text-clinic-text"
          >
            <ChevronRight size={20} />
          </button>
          <h1 className="text-2xl font-bold text-clinic-text">
            {therapist.fullName}
          </h1>
          {therapist.phone && (
            <span className="text-sm text-clinic-muted" dir="ltr">{formatPhone(therapist.phone)}</span>
          )}
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-clinic-text mb-4">פרטי קשר</h2>
          {contactError && (
            <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{contactError}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">טלפון</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => { setContactPhone(parsePhone(e.target.value)); setContactError(null); }}
                maxLength={10}
                inputMode="numeric"
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1">אימייל</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => { setContactEmail(e.target.value); setContactError(null); }}
                maxLength={100}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
                dir="ltr"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveContact}
              className="bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium"
            >
              שמור פרטי קשר
            </button>
            {contactSuccess && <span className="text-sm text-green-600">נשמר בהצלחה</span>}
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-clinic-text mb-4">שעות עבודה</h2>
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-clinic-border text-clinic-muted text-xs">
                <th className="text-right pb-2 font-medium">יום</th>
                <th className="text-right pb-2 font-medium">שעת התחלה</th>
                <th className="text-right pb-2 font-medium">שעת סיום</th>
                <th className="text-right pb-2 font-medium">יום חופש</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map(row => (
                <tr key={row.weekday} className="border-b border-clinic-border">
                  <td className="py-2 pr-0 font-medium text-clinic-text">{WEEKDAY_NAMES[row.weekday]}</td>
                  <td className="py-2">
                    <input
                      type="time"
                      value={row.startTime}
                      disabled={row.isDayOff}
                      onChange={e => updateDayRow(row.weekday, 'startTime', e.target.value)}
                      className="border border-clinic-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="time"
                      value={row.endTime}
                      disabled={row.isDayOff}
                      onChange={e => updateDayRow(row.weekday, 'endTime', e.target.value)}
                      className="border border-clinic-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={row.isDayOff}
                      onChange={e => updateDayRow(row.weekday, 'isDayOff', e.target.checked)}
                      className="w-4 h-4 accent-clinic-gold"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveHours}
              className="bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium"
            >
              שמור שעות עבודה
            </button>
            {hoursSuccess && (
              <span className="text-sm text-green-600">נשמר בהצלחה</span>
            )}
            {hoursError && (
              <span className="text-sm text-red-500">{hoursError}</span>
            )}
          </div>
        </div>

        {/* Unavailable Dates */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-clinic-text mb-4">תאריכים לא זמינים</h2>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
            />
            <button
              onClick={handleAddDate}
              disabled={!newDate}
              className="flex items-center gap-1 bg-clinic-gold text-white hover:opacity-90 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              הוסף
            </button>
          </div>
          {userDates.length === 0 ? (
            <p className="text-clinic-muted text-sm">אין תאריכים לא זמינים</p>
          ) : (
            <ul className="space-y-2">
              {userDates.map(d => (
                <li key={d.id} className="flex items-center justify-between border-b border-clinic-border pb-2">
                  <span className="text-clinic-text text-sm" dir="ltr">{d.date}</span>
                  <button
                    onClick={() => handleRemoveDate(d.date)}
                    className="text-clinic-muted hover:text-red-500 p-1"
                    title="הסר"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Capabilities */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-clinic-text mb-4">יכולות טיפול</h2>
          <div className="space-y-3">
            {treatmentTypes.map(tt => (
              <label key={tt.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userCapabilityIds.includes(tt.id)}
                  onChange={() => toggleCapability(tt.id)}
                  className="w-4 h-4 accent-clinic-gold"
                />
                <span className="text-clinic-text text-sm">{tt.name}</span>
              </label>
            ))}
          </div>
          {capsSuccess && (
            <p className="mt-3 text-sm text-green-600">יכולות עודכנו בהצלחה</p>
          )}
        </div>
      </div>
    </div>
  );
}
