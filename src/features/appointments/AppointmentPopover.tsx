import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Appointment } from '../../types/Appointment';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { useCustomers } from '../../contexts/CustomersContext';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../utils/date';
import { getDurationMinutes } from './appointmentService';
import { ApiRequestError } from '../../api/apiError';
import { Toast } from '../../components/shared/Toast';

interface AppointmentPopoverProps {
  appointment: Appointment;
  onClose: () => void;
}

export function AppointmentPopover({ appointment, onClose }: AppointmentPopoverProps) {
  const { cancelAppointment } = useAppointments();
  const { customers } = useCustomers();
  const { treatmentTypes } = useTreatmentTypes();
  const { currentUser } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const customer = customers.find(c => c.id === appointment.customerId);
  const treatmentType = treatmentTypes.find(tt => tt.id === appointment.treatmentTypeId);

  // Reschedule/cancel are Author-or-Manager only (backend 403 otherwise) — hide the affordance
  // entirely for anyone else, matching the TreatmentHistoryTab canDelete convention.
  const canManage = !!currentUser && (appointment.userId === currentUser.id || currentUser.role === 'Manager');

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelAppointment(appointment.id);
      setToast('התור בוטל');
      setTimeout(() => {
        setToast(null);
        onClose();
      }, 1500);
    } catch (e: unknown) {
      const msg = e instanceof ApiRequestError
        ? e.error.message
        : e instanceof Error ? e.message : 'שגיאה בביטול התור';
      setCancelError(msg);
    } finally {
      setCancelling(false);
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
              {treatmentType?.name ?? appointment.treatmentTypeName ?? appointment.treatmentTypeId}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">מטפלת</span>
            <p className="font-medium text-clinic-text">
              {appointment.userFullName}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">תאריך ושעה</span>
            <p className="font-medium text-clinic-text" dir="ltr">
              {formatDateTime(appointment.startTime)}
            </p>
          </div>
          <div>
            <span className="text-clinic-muted text-xs">משך</span>
            <p className="font-medium text-clinic-text">{getDurationMinutes(appointment)} דקות</p>
          </div>
        </div>

        {cancelError && (
          <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{cancelError}</p>
        )}

        {canManage && appointment.status === 'Scheduled' && (
          !confirming ? (
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
                  disabled={cancelling}
                  className="flex-1 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium disabled:opacity-50"
                >
                  {cancelling ? 'מבטל...' : 'בטל תור'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={cancelling}
                  className="flex-1 px-3 py-2 text-sm border border-clinic-border rounded-lg hover:bg-clinic-bg text-clinic-muted disabled:opacity-50"
                >
                  ביטול
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
