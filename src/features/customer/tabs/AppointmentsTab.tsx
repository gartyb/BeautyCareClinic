import { CheckCircle, XCircle, Clock, Ban } from 'lucide-react';
import { useAppointments } from '../../../contexts/AppointmentsContext';
import { useTherapists } from '../../../contexts/TherapistsContext';
import { useTreatmentTypes } from '../../../contexts/TreatmentTypesContext';
import { useCustomer } from '../../../contexts/CustomerContext';
import { formatDateTime } from '../../../utils/date';
import { Appointment } from '../../../types/Appointment';

const STATUS_CONFIG = {
  Scheduled:  { label: 'מתוכנן',       icon: Clock,       className: 'text-clinic-muted bg-clinic-bg border-clinic-border' },
  Completed:  { label: 'בוצע',          icon: CheckCircle, className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  NoShow:     { label: 'לא הופיעה',     icon: XCircle,     className: 'text-amber-600 bg-amber-50 border-amber-200' },
  Cancelled:  { label: 'בוטל',          icon: Ban,         className: 'text-red-400 bg-red-50 border-red-200' },
} satisfies Record<Appointment['status'], { label: string; icon: React.ElementType; className: string }>;

export function AppointmentsTab() {
  const { activeCustomer } = useCustomer();
  const { appointments, updateAppointmentStatus } = useAppointments();
  const { therapists } = useTherapists();
  const { treatmentTypes } = useTreatmentTypes();

  if (!activeCustomer) return null;

  const customerAppts = appointments
    .filter(a => a.customerId === activeCustomer.id)
    .sort((a, b) => b.appointmentDateTime.localeCompare(a.appointmentDateTime));

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
        const therapist = therapists.find(t => t.id === appt.therapistId);
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
                {formatDateTime(appt.appointmentDateTime)}
              </p>
              <p className="text-xs text-clinic-muted">{appt.durationMinutes} דק׳</p>
            </div>

            {/* Treatment + therapist */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-clinic-text truncate">
                {tt?.name ?? '—'}
              </p>
              <p className="text-xs text-clinic-muted truncate">
                {therapist ? `${therapist.firstName} ${therapist.lastName}` : '—'}
              </p>
            </div>

            {/* Status — always show both toggles (except Cancelled) */}
            {appt.status === 'Cancelled' ? (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium flex-shrink-0 ${cfg.className}`}>
                <StatusIcon size={14} />
                {cfg.label}
              </div>
            ) : (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => updateAppointmentStatus(appt.id, appt.status === 'Completed' ? 'Scheduled' : 'Completed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    appt.status === 'Completed'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white border-emerald-200 text-emerald-300 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  <CheckCircle size={14} />
                  בוצע
                </button>
                <button
                  onClick={() => updateAppointmentStatus(appt.id, appt.status === 'NoShow' ? 'Scheduled' : 'NoShow')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    appt.status === 'NoShow'
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-amber-200 text-amber-300 hover:border-amber-400 hover:text-amber-600'
                  }`}
                >
                  <XCircle size={14} />
                  לא הופיעה
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
