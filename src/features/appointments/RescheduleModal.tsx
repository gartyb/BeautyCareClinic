import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Appointment } from '../../types/Appointment';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useTherapists } from '../../contexts/TherapistsContext';
import { useTherapistData } from '../../contexts/TherapistDataContext';
import { getAvailableTherapists, getAvailableSlots } from './appointmentService';
import { Toast } from '../../components/shared/Toast';

interface RescheduleModalProps {
  appointment: Appointment | null;
  onClose: () => void;
}

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const STEPS = 3;

export function RescheduleModal({ appointment, onClose }: RescheduleModalProps) {
  const { appointments, rescheduleAppointment } = useAppointments();
  const { therapists } = useTherapists();
  const { workingHours, unavailableDates, capabilities } = useTherapistData();

  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = Boolean(appointment);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedDate('');
      setSelectedTherapistId(appointment?.therapistId ?? '');
      setSelectedSlot('');
      setError(null);
    }
  }, [open, appointment?.id, appointment?.therapistId]);

  useEffect(() => {
    setSelectedTherapistId(appointment?.therapistId ?? '');
    setSelectedSlot('');
  }, [selectedDate, appointment?.therapistId]);

  useEffect(() => {
    setSelectedSlot('');
  }, [selectedTherapistId]);

  if (!appointment) return null;

  // Exclude the appointment being rescheduled from availability checks
  const otherAppointments = appointments.filter(a => a.id !== appointment.id);

  const availableTherapists = selectedDate
    ? getAvailableTherapists(
        selectedDate,
        appointment.treatmentTypeId,
        therapists,
        workingHours,
        unavailableDates,
        capabilities,
        otherAppointments
      )
    : [];

  const availableSlots = selectedDate && selectedTherapistId
    ? getAvailableSlots(
        selectedDate,
        selectedTherapistId,
        appointment.durationMinutes,
        workingHours,
        unavailableDates,
        capabilities,
        appointment.treatmentTypeId,
        otherAppointments
      )
    : [];

  function canProceed(): boolean {
    if (step === 0) return Boolean(selectedDate);
    if (step === 1) return Boolean(selectedTherapistId);
    return Boolean(selectedSlot);
  }

  function handleSave() {
    if (!canProceed()) return;
    try {
      rescheduleAppointment(appointment!.id, `${selectedDate}T${selectedSlot}:00`, selectedTherapistId);
      setToast('התור עודכן בהצלחה');
      setTimeout(() => { setToast(null); onClose(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text">
              תאריך חדש <span className="text-red-400">*</span>
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
      case 1:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text">
              מטפלת <span className="text-red-400">*</span>
            </label>
            {availableTherapists.length === 0 ? (
              <p className="text-sm text-clinic-muted py-4 text-center">אין מטפלות זמינות לתאריך זה</p>
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
                    {t.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-clinic-text">
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
    }
  }

  const stepLabels = ['בחירת תאריך', 'בחירת מטפלת', 'בחירת שעה'];

  return (
    <>
      <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content
            dir="rtl"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-1">
              <Dialog.Title className="text-lg font-semibold text-clinic-text">
                עדכון תור
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-clinic-muted hover:text-clinic-text">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            <p className="text-xs text-clinic-muted mb-4">
              שלב {step + 1} מתוך {STEPS} — {stepLabels[step]}
            </p>

            <div className="w-full bg-clinic-bg rounded-full h-1.5 mb-6">
              <div
                className="bg-clinic-gold h-1.5 rounded-full transition-all"
                style={{ width: `${((step + 1) / STEPS) * 100}%` }}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</div>
            )}

            <div className="min-h-[150px]">{renderStep()}</div>

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
                הקודם
              </button>

              {step < STEPS - 1 ? (
                <button
                  onClick={() => canProceed() && setStep(s => s + 1)}
                  disabled={!canProceed()}
                  className="flex items-center gap-1 px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  הבא
                  <ChevronLeft size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={!canProceed()}
                  className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  שמור
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
