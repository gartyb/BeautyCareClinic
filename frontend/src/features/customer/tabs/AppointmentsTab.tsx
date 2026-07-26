import { CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { useAppointments } from '../../../contexts/AppointmentsContext';
import { useTreatmentTypes } from '../../../contexts/TreatmentTypesContext';
import { useCustomer } from '../../../contexts/CustomerContext';
import { formatDateTime } from '../../../utils/date';
import { getDurationMinutes } from '../../appointments/appointmentService';
import { Appointment } from '../../../types/Appointment';

const STATUS_CONFIG = {
  Scheduled:  { label: 'מתוכנן',       icon: Clock,       className: 'text-clinic-muted bg-clinic-bg border-clinic-border' },
  Completed:  { label: 'בוצע',          icon: CheckCircle, className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  NoShow:     { label: 'לא הופיעה',     icon: XCircle,     className: 'text-amber-600 bg-amber-50 border-amber-200' },
  Cancelled:  { label: 'בוטל',          icon: Ban,         className: 'text-red-400 bg-red-50 border-red-200' },
} satisfies Record<Appointment['status'], { label: string; icon: React.ElementType; className: string }>;

// Phase 011 note: this tab previously let a user toggle an appointment's status between
// Scheduled/Completed/NoShow directly (updateAppointmentStatus). The real backend's MVP scope
// (Q2) only supports Scheduled → Cancelled via DELETE — there is no status-update endpoint and no
// Completed/NoShow transition at all in this phase (that remains a separate, unlinked action from
// recording a Treatment). The interactive toggle buttons were removed accordingly; this tab is now
// a read-only history view of the customer's appointments and their (API-driven) status.
export function AppointmentsTab() {
  const { activeCustomer } = useCustomer();
  const { appointments, isLoading, error } = useAppointments();
  const { treatmentTypes } = useTreatmentTypes();

  if (!activeCustomer) return null;

  const customerAppts = appointments
    .filter(a => a.customerId === activeCustomer.id)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  if (isLoading && customerAppts.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>טוען תורים...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 text-sm">
        <p>{error}</p>
      </div>
    );
  }

  if (customerAppts.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין תורים ללקוחה זו.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-2" dir="rtl">
      {customerAppts.map(appt => {
        const tt = treatmentTypes.find(t => t.id === appt.treatmentTypeId);
        const cfg = STATUS_CONFIG[appt.status];
        const StatusIcon = cfg.icon;

        return (
          <div
            key={appt.id}
            className="bg-white rounded-xl border border-clinic-border px-4 py-3 flex items-center gap-4"
          >
            {/* Date + time */}
            <div className="flex-shrink-0 text-right min-w-[120px]">
              <p className="text-sm font-semibold text-clinic-text" dir="ltr">
                {formatDateTime(appt.startTime)}
              </p>
              <p className="text-xs text-clinic-muted">{getDurationMinutes(appt)} דק׳</p>
            </div>

            {/* Treatment + therapist */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-clinic-text truncate">
                {tt?.name ?? appt.treatmentTypeName ?? '—'}
              </p>
              <p className="text-xs text-clinic-muted truncate">
                {appt.userFullName || '—'}
              </p>
            </div>

            {/* Status — read-only (Phase 011 MVP: no status-change UI, see note above) */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium flex-shrink-0 ${cfg.className}`}>
              <StatusIcon size={14} />
              {cfg.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
