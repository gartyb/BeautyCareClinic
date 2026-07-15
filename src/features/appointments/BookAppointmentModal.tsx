import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import { useTherapists } from '../../contexts/TherapistsContext';
import { useTherapistData } from '../../contexts/TherapistDataContext';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useCustomers } from '../../contexts/CustomersContext';
import { useCustomer } from '../../contexts/CustomerContext';
import { usePackageTypes } from '../../contexts/PackageTypesContext';
import { activeSeries } from '../customer/selectors';
import { getAvailableTherapists, getAvailableSlots } from './appointmentService';
import { Toast } from '../../components/shared/Toast';

interface BookAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  customerId?: string; // pre-filled from Customer Card
}

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function BookAppointmentModal({ open, onClose, customerId }: BookAppointmentModalProps) {
  const { treatmentTypes } = useTreatmentTypes();
  const { therapists } = useTherapists();
  const { workingHours, unavailableDates, capabilities } = useTherapistData();
  const { appointments, createAppointment } = useAppointments();
  const { customers } = useCustomers();
  const { allSeries } = useCustomer();
  const { packageTypes } = usePackageTypes();

  const hasPrefilledCustomer = Boolean(customerId);
  // If customer is pre-filled: steps 0..4 → total 5 steps (0-indexed)
  // If not pre-filled: steps 0..5 → total 6 steps (step 0 = pick customer)
  const TOTAL_STEPS = hasPrefilledCustomer ? 5 : 6;

  const [step, setStep] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId ?? '');

  const effectiveCustomerId = hasPrefilledCustomer ? customerId! : selectedCustomerId;
  const [selectedTreatmentTypeId, setSelectedTreatmentTypeId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [durationStr, setDurationStr] = useState('60');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedCustomerId(customerId ?? '');
      setSelectedTreatmentTypeId('');
      setSelectedDate('');
      setSelectedTherapistId('');
      setDurationMinutes(60);
      setDurationStr('60');
      setSelectedSlot('');
      setError(null);
    }
  }, [open, customerId]);

  // Update duration when treatment type changes
  useEffect(() => {
    if (selectedTreatmentTypeId) {
      const tt = treatmentTypes.find(t => t.id === selectedTreatmentTypeId);
      if (tt) {
        setDurationMinutes(tt.defaultDurationMinutes);
        setDurationStr(String(tt.defaultDurationMinutes));
      }
    }
  }, [selectedTreatmentTypeId, treatmentTypes]);

  // Reset treatment type when customer changes
  useEffect(() => {
    setSelectedTreatmentTypeId('');
  }, [selectedCustomerId]);

  // Reset downstream selections when upstream changes
  useEffect(() => {
    setSelectedTherapistId('');
    setSelectedSlot('');
  }, [selectedTreatmentTypeId, selectedDate]);

  useEffect(() => {
    setSelectedSlot('');
  }, [selectedTherapistId, durationMinutes]);

  const filteredTreatmentTypes = useMemo(() => {
    if (!effectiveCustomerId) return treatmentTypes;
    const customerActiveSeries = activeSeries(allSeries.filter(s => s.customerId === effectiveCustomerId));
    if (customerActiveSeries.length === 0) return [];
    const activeTypeIds = new Set(
      customerActiveSeries.map(s => packageTypes.find(p => p.id === s.packageTypeId)?.treatmentTypeId).filter(Boolean)
    );
    return treatmentTypes.filter(tt => activeTypeIds.has(tt.id));
  }, [effectiveCustomerId, allSeries, packageTypes, treatmentTypes]);

  const availableTherapists = selectedTreatmentTypeId && selectedDate
    ? getAvailableTherapists(
        selectedDate,
        selectedTreatmentTypeId,
        therapists,
        workingHours,
        unavailableDates,
        capabilities,
        appointments
      )
    : [];

  const parsedDuration = parseInt(durationStr, 10);
  const durationValid = Number.isInteger(parsedDuration) && parsedDuration > 0;

  const availableSlots = selectedTherapistId && selectedDate && selectedTreatmentTypeId && durationValid
    ? getAvailableSlots(
        selectedDate,
        selectedTherapistId,
        parsedDuration,
        workingHours,
        unavailableDates,
        capabilities,
        selectedTreatmentTypeId,
        appointments
      )
    : [];

  // Step labels (0-indexed, adjusted for pre-filled)
  function getStepLabel(): string {
    const displayStep = step + 1;
    return `שלב ${displayStep} מתוך ${TOTAL_STEPS}`;
  }

  function getStepTitle(): string {
    if (!hasPrefilledCustomer) {
      if (step === 0) return 'בחירת לקוחה';
      const inner = step - 1;
      return getInnerStepTitle(inner);
    }
    return getInnerStepTitle(step);
  }

  function getInnerStepTitle(innerStep: number): string {
    switch (innerStep) {
      case 0: return 'בחירת סוג טיפול';
      case 1: return 'בחירת תאריך';
      case 2: return 'בחירת מטפלת';
      case 3: return 'משך הטיפול';
      case 4: return 'בחירת שעה';
      default: return '';
    }
  }

  function canProceed(): boolean {
    if (!hasPrefilledCustomer && step === 0) return Boolean(selectedCustomerId);
    const inner = hasPrefilledCustomer ? step : step - 1;
    switch (inner) {
      case 0: return Boolean(selectedTreatmentTypeId);
      case 1: return Boolean(selectedDate);
      case 2: return Boolean(selectedTherapistId);
      case 3: return durationValid;
      case 4: return Boolean(selectedSlot);
      default: return false;
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  function handleNext() {
    if (!canProceed()) return;
    setError(null);
    setStep(s => s + 1);
  }

  function handlePrev() {
    setError(null);
    setStep(s => s - 1);
  }

  function handleSave() {
    if (!canProceed()) return;
    try {
      const dateTime = `${selectedDate}T${selectedSlot}:00`;
      const duration = parseInt(durationStr, 10);
      const custId = hasPrefilledCustomer ? customerId! : selectedCustomerId;
      createAppointment(custId, selectedTreatmentTypeId, selectedTherapistId, dateTime, duration);
      setToast('התור נקבע בהצלחה');
      setTimeout(() => {
        setToast(null);
        onClose();
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    }
  }

  function renderStepContent() {
    if (!hasPrefilledCustomer && step === 0) {
      // Step 0: Customer selection
      return (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-clinic-text mb-1">
            לקוחה <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="rtl"
          >
            <option value="">— בחר לקוחה —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>
      );
    }

    const inner = hasPrefilledCustomer ? step : step - 1;

    switch (inner) {
      case 0: // Treatment type
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text mb-1">
              סוג טיפול <span className="text-red-400">*</span>
            </label>
            {filteredTreatmentTypes.length === 0 ? (
              <p className="text-sm text-clinic-muted py-4 text-center">אין חבילות פעילות ללקוחה זו</p>
            ) : (
              <select
                value={selectedTreatmentTypeId}
                onChange={e => setSelectedTreatmentTypeId(e.target.value)}
                className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
                dir="rtl"
              >
                <option value="">— בחר סוג טיפול —</option>
                {filteredTreatmentTypes.map(tt => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            )}
          </div>
        );

      case 1: // Date
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text mb-1">
              תאריך <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              min={todayISO()}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
            />
          </div>
        );

      case 2: // Therapist
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text mb-1">
              מטפלת <span className="text-red-400">*</span>
            </label>
            {availableTherapists.length === 0 ? (
              <p className="text-sm text-clinic-muted py-4 text-center">
                אין מטפלות זמינות לתאריך וסוג טיפול זה
              </p>
            ) : (
              <div className="space-y-2">
                {availableTherapists.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTherapistId(t.id)}
                    className={`w-full text-right px-4 py-3 rounded-lg border text-sm transition-colors ${
                      selectedTherapistId === t.id
                        ? 'border-clinic-gold bg-clinic-blush text-clinic-gold font-medium'
                        : 'border-clinic-border hover:bg-clinic-bg'
                    }`}
                  >
                    {t.firstName} {t.lastName}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 3: // Duration
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text mb-1">
              משך הטיפול (דקות) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={durationStr}
              onChange={e => {
                setDurationStr(e.target.value);
                const n = parseInt(e.target.value, 10);
                if (Number.isInteger(n) && n > 0) setDurationMinutes(n);
              }}
              min={1}
              step={1}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
            />
            {!durationValid && durationStr !== '' && (
              <p className="text-xs text-red-500">יש להזין מספר שלם גדול מ-0</p>
            )}
          </div>
        );

      case 4: // Time slot
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text mb-1">
              שעה <span className="text-red-400">*</span>
            </label>
            {availableSlots.length === 0 ? (
              <p className="text-sm text-clinic-muted py-4 text-center">אין שעות פנויות</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-2 py-2 rounded-lg border text-sm transition-colors ${
                      selectedSlot === slot
                        ? 'border-clinic-gold bg-clinic-blush text-clinic-gold font-medium'
                        : 'border-clinic-border hover:bg-clinic-bg'
                    }`}
                    dir="ltr"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content
            dir="rtl"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-1">
              <Dialog.Title className="text-lg font-semibold text-clinic-text">
                קביעת תור
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-clinic-muted hover:text-clinic-text">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            <p className="text-xs text-clinic-muted mb-4">{getStepLabel()} — {getStepTitle()}</p>

            {/* Progress bar */}
            <div className="w-full bg-clinic-bg rounded-full h-1.5 mb-6">
              <div
                className="bg-clinic-gold h-1.5 rounded-full transition-all"
                style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>
            )}

            <div className="min-h-[150px]">
              {renderStepContent()}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={handlePrev}
                disabled={step === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
                הקודם
              </button>

              {isLastStep ? (
                <button
                  onClick={handleSave}
                  disabled={!canProceed()}
                  className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  שמור
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex items-center gap-1 px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  הבא
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
