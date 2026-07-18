import type { ReactNode } from 'react';
import { Calendar, AlertCircle, CreditCard, Zap, Package } from 'lucide-react';
import { useCustomer } from '../../contexts/CustomerContext';
import { useAppointments } from '../../contexts/AppointmentsContext';
import {
  outstandingBalance,
  totalPaid,
  remainingUnits,
  activeSeries,
} from './selectors';
import { getNextAppointment } from '../appointments/appointmentService';
import { formatDateTime } from '../../utils/date';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

function KpiCard({ icon, label, value }: KpiCardProps) {
  return (
    <div className="flex-1 bg-white rounded-xl border border-clinic-border px-3 py-3 flex flex-col items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full bg-clinic-blush flex items-center justify-center">
        {icon}
      </div>
      <span className="text-xs text-clinic-muted leading-tight text-center">{label}</span>
      <div className="font-bold text-clinic-text text-sm text-center leading-tight">{value}</div>
    </div>
  );
}

export function SummaryRow() {
  const { activeCustomer, orders, payments, treatmentSeries } = useCustomer();
  const { appointments } = useAppointments();

  const next = activeCustomer
    ? getNextAppointment(activeCustomer.id, appointments)
    : null;
  const balance = outstandingBalance(orders);
  const paid = totalPaid(payments);
  const remaining = remainingUnits(treatmentSeries);
  const activeCount = activeSeries(treatmentSeries).length;

  return (
    <div className="flex gap-3 px-6 py-4 bg-clinic-bg border-b border-clinic-border">
      <KpiCard
        icon={<Calendar size={15} className="text-clinic-gold" />}
        label="תור הבא"
        value={next ? formatDateTime(next.appointmentDateTime) : 'אין'}
      />
      <KpiCard
        icon={<AlertCircle size={15} className={balance > 0 ? 'text-red-400' : 'text-green-500'} />}
        label="יתרת חוב"
        value={
          <span className={balance > 0 ? 'text-red-500' : 'text-green-600'}>
            ₪{balance.toLocaleString('he-IL')}
          </span>
        }
      />
      <KpiCard
        icon={<CreditCard size={15} className="text-clinic-gold" />}
        label='סה"כ שולם'
        value={<span className="text-clinic-gold">₪{paid.toLocaleString('he-IL')}</span>}
      />
      <KpiCard
        icon={<Zap size={15} className="text-clinic-gold" />}
        label="יחידות שנותרו"
        value={remaining}
      />
      <KpiCard
        icon={<Package size={15} className="text-clinic-gold" />}
        label="חבילות פעילות"
        value={activeCount}
      />
    </div>
  );
}
