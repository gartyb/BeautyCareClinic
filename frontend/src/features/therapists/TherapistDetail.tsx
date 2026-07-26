import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Trash2, Plus, UserX } from 'lucide-react';
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
        isDayOff: !existing.startTime && !existing.endTime,
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
    isLoading: therapistDataLoading,
    saveTherapistWorkingHours,
    addTherapistUnavailableDate,
    removeTherapistUnavailableDate,
    addTherapistCapability,
    removeTherapistCapability,
  } = useTherapistData();

  const { treatmentTypes } = useTreatmentTypes();
  const { therapists, updateTherapist, deactivateTherapist } = useTherapists();
  const therapist = therapists.find(u => u.id === userId);
  const isReadOnly = therapist ? therapist.isActive === false : false;

  const [dayRows, setDayRows] = useState<DayRow[]>([]);
  const [newDate, setNewDate] = useState('');
  const [hoursSuccess, setHoursSuccess] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [capsSuccess, setCapsSuccess] = useState(false);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [savingCapabilityId, setSavingCapabilityId] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [dateSaving, setDateSaving] = useState(false);
  const [removingDate, setRemovingDate] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const hoursSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capsSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededForUserIdRef = useRef<string | null>(null);

  // Seed dayRows and contact fields once per therapist navigation. `therapist` (from
  // TherapistsContext, GET /api/v1/users?role=Therapist) and `workingHours` (from the
  // completely separate TherapistDataContext, GET /api/v1/therapists/availability) are fetched
  // independently and asynchronously, so either one can resolve first. We must not seed until
  // BOTH have settled: seeding as soon as `therapist` is truthy — while `workingHours` is still
  // its initial `[]` because TherapistDataContext's fetch hasn't finished — would lock in an
  // all-day-off dayRows snapshot via `seededForUserIdRef`, and the real data arriving moments
  // later would never re-seed. `therapistDataLoading` (TherapistDataContext's `isLoading`)
  // tracks whether that fetch has settled, so we gate the seed on it as well as on `therapist`.
  // `seededForUserIdRef` still ensures we only seed once per userId, so a later background
  // refetch (e.g. triggered by saving one section) doesn't clobber unsaved edits elsewhere.
  useEffect(() => {
    if (userId && therapist && !therapistDataLoading && seededForUserIdRef.current !== userId) {
      setDayRows(buildDefaultDayRows(userId, workingHours));
      setContactPhone(therapist.phone ?? '');
      setContactEmail(therapist.email);
      setContactError(null);
      seededForUserIdRef.current = userId;
    }
  }, [userId, therapist, workingHours, therapistDataLoading]);

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

  async function handleSaveContact() {
    setContactError(null);
    setContactSaving(true);
    try {
      await updateTherapist(userId!, contactPhone, contactEmail);
      setContactSuccess(true);
      if (contactSuccessTimer.current) clearTimeout(contactSuccessTimer.current);
      contactSuccessTimer.current = setTimeout(() => setContactSuccess(false), 2000);
    } catch (e) {
      setContactError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setContactSaving(false);
    }
  }

  function updateDayRow(weekday: number, field: keyof DayRow, value: string | boolean) {
    setDayRows(prev =>
      prev.map(r => r.weekday === weekday ? { ...r, [field]: value } : r)
    );
  }

  async function handleSaveHours() {
    setHoursError(null);
    const hoursInput = dayRows.map(r => ({
      weekday: r.weekday,
      startTime: r.isDayOff ? null : (r.startTime || null),
      endTime: r.isDayOff ? null : (r.endTime || null),
    }));
    setHoursSaving(true);
    try {
      // Client-side pre-validation (fail fast, no round trip) — same rules the backend enforces.
      const validated = updateTherapistWorkingHours(userId!, hoursInput, workingHours);
      await saveTherapistWorkingHours(userId!, validated.filter(h => h.userId === userId));
      setHoursSuccess(true);
      if (hoursSuccessTimer.current) clearTimeout(hoursSuccessTimer.current);
      hoursSuccessTimer.current = setTimeout(() => setHoursSuccess(false), 2000);
    } catch (e) {
      if (e instanceof DomainError || e instanceof Error) {
        setHoursError(e.message);
      } else {
        setHoursError('שגיאה לא צפויה');
      }
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleAddDate() {
    if (!newDate) return;
    setDateError(null);
    setDateSaving(true);
    try {
      await addTherapistUnavailableDate({ id: '', userId: userId!, date: newDate });
      setNewDate('');
    } catch (e) {
      setDateError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setDateSaving(false);
    }
  }

  async function handleRemoveDate(date: string) {
    setDateError(null);
    setRemovingDate(date);
    try {
      await removeTherapistUnavailableDate(userId!, date);
    } catch (e) {
      setDateError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setRemovingDate(null);
    }
  }

  const userDates = unavailableDates.filter(d => d.userId === userId).sort((a, b) => a.date.localeCompare(b.date));

  const userCapabilityIds = capabilities
    .filter(c => c.userId === userId)
    .map(c => c.treatmentTypeId);

  async function toggleCapability(ttId: string) {
    setCapsError(null);
    setSavingCapabilityId(ttId);
    try {
      if (userCapabilityIds.includes(ttId)) {
        await removeTherapistCapability(userId!, ttId);
      } else {
        await addTherapistCapability(userId!, ttId);
      }
      setCapsSuccess(true);
      if (capsSuccessTimer.current) clearTimeout(capsSuccessTimer.current);
      capsSuccessTimer.current = setTimeout(() => setCapsSuccess(false), 2000);
    } catch (e) {
      setCapsError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setSavingCapabilityId(null);
    }
  }

  async function handleConfirmDeactivate() {
    setDeactivateError(null);
    setDeactivating(true);
    try {
      await deactivateTherapist(userId!);
      setConfirmingDeactivate(false);
    } catch (e) {
      setDeactivateError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setDeactivating(false);
    }
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
          {therapist.isActive === false && (
            <span className="text-xs font-medium bg-red-100 text-red-600 rounded-full px-3 py-1">
              לא פעילה
            </span>
          )}
          {therapist.phone && (
            <span className="text-sm text-clinic-muted" dir="ltr">{formatPhone(therapist.phone)}</span>
          )}
          <div className="flex-1" />
          {therapist.isActive !== false && (
            <button
              onClick={() => setConfirmingDeactivate(true)}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5"
            >
              <UserX size={16} />
              בטל פעילות
            </button>
          )}
        </div>

        {confirmingDeactivate && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3" dir="rtl">
            <p className="text-sm text-clinic-text">
              לבטל את פעילותה של <strong>{therapist.fullName}</strong>? היא תוסר ממסך קביעת התורים,
              אך התורים, הטיפולים וההערות ההיסטוריים שלה יישארו זמינים כרגיל.
            </p>
            {deactivateError && <p className="text-sm text-red-600">{deactivateError}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmDeactivate}
                disabled={deactivating}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
              >
                {deactivating ? 'מבטל...' : 'בטל פעילות'}
              </button>
              <button
                onClick={() => { setConfirmingDeactivate(false); setDeactivateError(null); }}
                disabled={deactivating}
                className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text disabled:opacity-40"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

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
                disabled={isReadOnly}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
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
                disabled={isReadOnly}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
                dir="ltr"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveContact}
              disabled={isReadOnly || contactSaving}
              className="bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {contactSaving ? 'שומר...' : 'שמור פרטי קשר'}
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
                      disabled={row.isDayOff || isReadOnly}
                      onChange={e => updateDayRow(row.weekday, 'startTime', e.target.value)}
                      className="border border-clinic-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="time"
                      value={row.endTime}
                      disabled={row.isDayOff || isReadOnly}
                      onChange={e => updateDayRow(row.weekday, 'endTime', e.target.value)}
                      className="border border-clinic-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={row.isDayOff}
                      disabled={isReadOnly}
                      onChange={e => updateDayRow(row.weekday, 'isDayOff', e.target.checked)}
                      className="w-4 h-4 accent-clinic-gold disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveHours}
              disabled={isReadOnly || hoursSaving}
              className="bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hoursSaving ? 'שומר...' : 'שמור שעות עבודה'}
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
          {dateError && (
            <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{dateError}</div>
          )}
          <div className="flex items-center gap-3 mb-4">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              disabled={isReadOnly}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold disabled:opacity-40 disabled:cursor-not-allowed"
              dir="ltr"
            />
            <button
              onClick={handleAddDate}
              disabled={!newDate || isReadOnly || dateSaving}
              className="flex items-center gap-1 bg-clinic-gold text-white hover:opacity-90 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              {dateSaving ? 'מוסיף...' : 'הוסף'}
            </button>
          </div>
          {userDates.length === 0 ? (
            <p className="text-clinic-muted text-sm">אין תאריכים לא זמינים</p>
          ) : (
            <ul className="space-y-2">
              {userDates.map(d => (
                <li key={d.id || d.date} className="flex items-center justify-between border-b border-clinic-border pb-2">
                  <span className="text-clinic-text text-sm" dir="ltr">{d.date}</span>
                  <button
                    onClick={() => handleRemoveDate(d.date)}
                    disabled={isReadOnly || removingDate === d.date}
                    className="text-clinic-muted hover:text-red-500 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
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
          {capsError && (
            <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{capsError}</div>
          )}
          <div className="space-y-3">
            {treatmentTypes.map(tt => (
              <label key={tt.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userCapabilityIds.includes(tt.id)}
                  disabled={isReadOnly || savingCapabilityId === tt.id}
                  onChange={() => toggleCapability(tt.id)}
                  className="w-4 h-4 accent-clinic-gold disabled:opacity-40"
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
