import { useState } from 'react';
import { X, CalendarDays } from 'lucide-react';
import { Appointment } from '../../../types/Appointment';
import { useCustomers } from '../../../contexts/CustomersContext';
import { useTherapists } from '../../../contexts/TherapistsContext';
import { useTreatmentTypes } from '../../../contexts/TreatmentTypesContext';
import { useGlobalSettings } from '../../../contexts/GlobalSettingsContext';
import { useAppointments } from '../../../contexts/AppointmentsContext';
import { AppointmentPopover } from '../AppointmentPopover';
import { RescheduleModal } from '../RescheduleModal';
import { Toast } from '../../../components/shared/Toast';

const SLOT_MINUTES = 30;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function slotTimeLabel(slotIndex: number, gridStartHour: number): string {
  const totalMinutes = gridStartHour * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad(h)}:${pad(m)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface CalendarGridProps {
  selectedDate: Date;
  appointments: Appointment[];
}

interface AppointmentBlock {
  appointment: Appointment;
  slotStart: number;
  slotSpan: number;
}

export function CalendarGrid({ selectedDate, appointments }: CalendarGridProps) {
  const { customers } = useCustomers();
  const { therapists } = useTherapists();
  const { treatmentTypes } = useTreatmentTypes();
  const { calendarStartHour, calendarEndHour } = useGlobalSettings();
  const { cancelAppointment } = useAppointments();
  const [popoverAppt, setPopoverAppt] = useState<Appointment | null>(null);
  const [popoverEl, setPopoverEl] = useState<HTMLElement | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function confirmCancel(e: React.MouseEvent) {
    e.stopPropagation();
    if (cancellingId) {
      cancelAppointment(cancellingId);
      setToast('התור בוטל');
    }
    setCancellingId(null);
  }

  function abortCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setCancellingId(null);
  }

  const GRID_START_HOUR = calendarStartHour;
  const GRID_END_HOUR = calendarEndHour;
  const TOTAL_SLOTS = ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES;

  const dayAppointments = appointments.filter(a => {
    if (a.status === 'Cancelled') return false;
    return isSameDay(new Date(a.appointmentDateTime), selectedDate);
  });

  function getBlocksForTherapist(therapistId: string): AppointmentBlock[] {
    return dayAppointments
      .filter(a => a.therapistId === therapistId)
      .map(appt => {
        const apptDate = new Date(appt.appointmentDateTime);
        const startMinutes =
          (apptDate.getHours() - GRID_START_HOUR) * 60 + apptDate.getMinutes();
        const slotStart = Math.floor(startMinutes / SLOT_MINUTES);
        const slotSpan = Math.max(1, Math.ceil(appt.durationMinutes / SLOT_MINUTES));
        return { appointment: appt, slotStart, slotSpan };
      })
      .filter(b => b.slotStart >= 0 && b.slotStart < TOTAL_SLOTS);
  }

  function handleApptClick(e: React.MouseEvent<HTMLElement>, appt: Appointment) {
    e.stopPropagation();
    setPopoverAppt(appt);
    setPopoverEl(e.currentTarget);
  }

  const rows = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);
  const gridCols = `60px repeat(${therapists.length}, minmax(120px, 1fr))`;

  return (
    <div className="relative overflow-auto" onClick={() => setPopoverAppt(null)}>
      {/* Header row — therapist names */}
      <div
        className="grid border-b border-clinic-border bg-white sticky top-0 z-10"
        style={{ gridTemplateColumns: gridCols, direction: 'rtl' }}
      >
        <div className="h-12" />
        {therapists.map(t => (
          <div
            key={t.id}
            className="h-12 flex items-center justify-center text-xs font-semibold text-clinic-text border-r border-clinic-border first:border-r-0 px-2 text-center"
          >
            {t.fullName}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="relative">
        {rows.map(slotIdx => (
          <div
            key={slotIdx}
            className="grid border-b border-clinic-border/50"
            style={{ gridTemplateColumns: gridCols, direction: 'rtl', minHeight: '48px' }}
          >
            {/* Time label */}
            <div className="text-xs text-clinic-muted px-2 py-1 flex items-start justify-end border-l border-clinic-border">
              {slotTimeLabel(slotIdx, GRID_START_HOUR)}
            </div>

            {/* Therapist columns */}
            {therapists.map(therapist => {
              const block = getBlocksForTherapist(therapist.id)
                .find(b => b.slotStart === slotIdx);

              const customer = block
                ? customers.find(c => c.id === block.appointment.customerId)
                : null;
              const tt = block
                ? treatmentTypes.find(t => t.id === block.appointment.treatmentTypeId)
                : null;

              return (
                <div
                  key={therapist.id}
                  className="border-r border-clinic-border/30 last:border-r-0 relative"
                  style={{ minHeight: '48px' }}
                >
                  {block && (() => {
                    const isConfirming = cancellingId === block.appointment.id;
                    return (
                      <div
                        className={`absolute inset-x-0.5 top-0.5 rounded-md border flex flex-col transition-colors z-10 ${
                          isConfirming
                            ? 'bg-red-50 border-red-300'
                            : 'bg-clinic-blush border-clinic-gold/50'
                        }`}
                        style={{ height: `${block.slotSpan * 48 - 4}px` }}
                      >
                        {isConfirming ? (
                          <div className="flex flex-col items-center justify-center h-full gap-2 px-2">
                            <p className="text-xs text-red-600 font-semibold text-center">לבטל את התור?</p>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={confirmCancel}
                                className="flex-1 flex items-center justify-center px-2 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors"
                              >
                                כן, בטל
                              </button>
                              <button
                                onClick={abortCancel}
                                className="flex-1 flex items-center justify-center px-2 py-1.5 border border-clinic-border rounded-lg text-xs font-medium text-clinic-muted hover:bg-white transition-colors"
                              >
                                לא
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col h-full">
                            {/* Info — clickable for popover */}
                            <div
                              className="flex-1 min-h-0 px-2 pt-1 cursor-pointer overflow-hidden"
                              onClick={e => handleApptClick(e, block.appointment)}
                            >
                              <p className="text-xs font-semibold text-clinic-text truncate leading-tight">
                                {customer ? customer.fullName : '—'}
                              </p>
                              {tt && (
                                <p className="text-xs text-clinic-gold truncate leading-tight">{tt.name}</p>
                              )}
                            </div>

                            {/* Action buttons — bottom row */}
                            <div className="flex gap-1 px-1.5 pb-1.5 pt-1 flex-shrink-0">
                              <button
                                onClick={e => { e.stopPropagation(); setReschedulingAppt(block.appointment); setPopoverAppt(null); }}
                                className="flex flex-1 items-center justify-center gap-1 py-1.5 border border-clinic-gold text-clinic-gold rounded-lg text-xs font-medium hover:bg-clinic-gold hover:text-white transition-colors"
                              >
                                <CalendarDays size={13} />
                                <span>עדכן</span>
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setCancellingId(block.appointment.id); setPopoverAppt(null); }}
                                className="flex flex-1 items-center justify-center gap-1 py-1.5 border border-red-300 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500 hover:text-white transition-colors"
                              >
                                <X size={13} />
                                <span>בטל</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <RescheduleModal
        appointment={reschedulingAppt}
        onClose={() => setReschedulingAppt(null)}
      />

      {/* Popover */}
      {popoverAppt && popoverEl && (() => {
        const rect = popoverEl.getBoundingClientRect();
        const POPOVER_H = 340;
        const POPOVER_W = 272;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow >= POPOVER_H
          ? rect.bottom + 4
          : Math.max(8, rect.top - POPOVER_H - 4);
        const left = Math.min(rect.left, window.innerWidth - POPOVER_W - 8);
        return (
          <div className="fixed z-50" style={{ top, left: Math.max(8, left) }}>
            <AppointmentPopover
              appointment={popoverAppt}
              onClose={() => setPopoverAppt(null)}
            />
          </div>
        );
      })()}
    </div>
  );
}
