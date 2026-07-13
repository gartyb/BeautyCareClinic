import { useCustomer } from '../../../contexts/CustomerContext';
import { therapists } from '../../../data/therapists';
import { Payment } from '../../../types/Payment';
import { formatDate } from '../../../utils/date';

const methodLabels: Record<Payment['method'], string> = {
  Cash: 'מזומן',
  'Credit Card': 'כרטיס אשראי',
  'Bank Transfer': 'העברה בנקאית',
  Other: 'אחר',
};

export function PaymentsTab() {
  const { payments } = useCustomer();

  const sorted = [...payments].sort((a, b) =>
    b.paymentDate.localeCompare(a.paymentDate)
  );

  if (sorted.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין תשלומים.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-3">
      {sorted.map((payment: Payment) => {
        const recorder = therapists.find(t => t.id === payment.createdByUserId);
        const shortOrderId = payment.customerOrderId.replace('order-', '#');

        return (
          <div
            key={payment.id}
            className="bg-clinic-blush rounded-xl shadow-sm p-4 flex items-center justify-between"
          >
            <div className="flex flex-col items-start gap-0.5 text-sm">
              <span className="text-clinic-muted">הזמנה {shortOrderId}</span>
              {recorder && (
                <span className="text-xs text-clinic-muted">
                  נרשם ע&quot;י {recorder.firstName} {recorder.lastName}
                </span>
              )}
            </div>

            <div className="flex flex-col items-end gap-0.5">
              <span className="font-bold text-clinic-text">
                ₪{parseFloat(payment.amount).toLocaleString('he-IL')}
              </span>
              <span className="text-sm text-clinic-muted">{methodLabels[payment.method]}</span>
              <span className="text-xs text-clinic-muted">{formatDate(payment.paymentDate)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
