import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Appointment } from '../../types/Appointment';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useCustomers } from '../../contexts/CustomersContext';
import { useTherapists } from '../../contexts/TherapistsContext';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import { formatDateTime } from '../../utils/date';
import { Toast } from '../../components/shared/Toast';

interface AppointmentPopoverProps {
  appointment: Appointment;
  onClose: () => void;
}

export function AppointmentPopover({ appointment, onClose }: AppointmentPopoverProps) {
  const { cancelAppointment } = useAppointments();
  const { customers } = useCustomers();
  const { therapists } = useTherapists();
  const { treatmentTypes } = useTreatmentTypes();
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const customer = customers.find(c => c.id === appointment.customerId);
  const therapist = therapists.find(t => t.id === appointment.therapistId);
  const treatmentType = treatmentTypes.find(tt => tt.id === appointment.treatmentTypeId);

  function handleCancel() {
    try {
      cancelAppointment(appointment.id);
      setToast('התור בוטל');
      setTimeout(() => {
        setToast(null);
        onClose();
      }, 1500);
    } catch (e: unknown) {
      console.error('[cancelAppointment]', e);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        dir="rtl"
        className="relative z-50 bg-white rounded-xl shadow-xl border border-clinic-border p-4 w-64"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="font-semibold text-clinic-text text-sm">פרטי תור</span>
          <button onClick={onClose} className="text-clinic-muted hover:text-clinic-text">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <span className="text-clinic-muted text-xs">לקוחה</span>
            <p className="font-medium text-clinic-text">
              {customer ? customer.fullName : appointment.customerId}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">סוג טיפול</span>
            <p className="font-medium text-clinic-text">
              {treatmentType?.name ?? appointment.treatmentTypeId}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">מטפלת</span>
            <p className="font-medium text-clinic-text">
              {therapist ? therapist.fullName : appointment.therapistId}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">תאריך ושעה</span>
            <p className="font-medium text-clinic-text" dir="ltr">
              {formatDateTime(appointment.appointmentDateTime)}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">משך</span>
            <p className="font-medium text-clinic-text">{appointment.durationMinutes} דקות</p>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            בטל תור
          </button>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-clinic-text text-center">האם לבטל את התור?</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
              >
                בטל תור
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 px-3 py-2 text-sm border border-clinic-border rounded-lg hover:bg-clinic-bg text-clinic-muted"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
