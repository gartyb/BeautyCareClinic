import { useState } from 'react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { usePackageTypes } from '../../../contexts/PackageTypesContext';
import { Badge } from '../../../components/shared/Badge';
import { RecordPaymentModal } from '../../payment/RecordPaymentModal';
import { paymentsForOrder } from '../../customer/selectors';
import { CustomerOrder } from '../../../types/Order';
import { Payment } from '../../../types/Payment';
import type { User } from '../../../types/User';
import { formatDate } from '../../../utils/date';

interface OrdersTabProps {
  currentUser: User;
}

const methodLabels: Record<Payment['method'], string> = {
  Cash: 'מזומן',
  'Credit Card': 'כרטיס אשראי',
  'Bank Transfer': 'העברה בנקאית',
  Other: 'אחר',
};

function getPaymentStatus(order: CustomerOrder): { label: string; variant: 'success' | 'warning' | 'error' } {
  const remaining = parseFloat(order.remainingBalance);
  const paid = parseFloat(order.amountPaid);
  if (remaining === 0) return { label: 'שולם במלואו', variant: 'success' };
  if (paid === 0) return { label: 'ממתין לתשלום', variant: 'error' };
  return { label: 'חלקי', variant: 'warning' };
}

export function OrdersTab({ currentUser }: OrdersTabProps) {
  const { orders, payments } = useCustomer();
  const { packageTypes } = usePackageTypes();
  const [paymentModalOrderId, setPaymentModalOrderId] = useState<string | null>(null);

  const sorted = [...orders].sort((a, b) => b.createdDate.localeCompare(a.createdDate));

  if (sorted.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין הזמנות. לחץ &apos;הזמנה חדשה&apos; להתחיל.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 flex flex-col gap-4">
        {sorted.map((order: CustomerOrder, index: number) => {
          const status = getPaymentStatus(order);
          const orderPayments = [...paymentsForOrder(payments, order.id)]
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
          const canPay = order.paymentCount < order.maxPaymentCount;

          return (
            <div key={order.id} className="bg-white rounded-xl border border-clinic-border shadow-sm overflow-hidden">

              {/* Order header */}
              <div className="flex items-center justify-between px-4 py-3 bg-clinic-blush">
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <button
                    onClick={() => canPay && setPaymentModalOrderId(order.id)}
                    disabled={!canPay}
                    title={canPay ? undefined : 'הגעת למספר התשלומים המקסימלי'}
                    className="px-2.5 py-1 text-xs border border-clinic-gold text-clinic-gold rounded-lg hover:bg-clinic-blush transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    רשום תשלום
                  </button>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm font-medium text-clinic-text">
                    הזמנה #{sorted.length - index}
                  </span>
                  <span className="text-xs text-clinic-muted">{formatDate(order.createdDate)}</span>
                </div>
              </div>

              {/* Package items */}
              <ul dir="rtl" className="px-4 py-2 border-b border-clinic-border flex flex-col gap-1">
                {order.orderItems.map(item => {
                  const pkg = packageTypes.find(p => p.id === item.packageTypeId);
                  return (
                    <li key={item.id} className="flex items-center gap-1.5 text-sm text-clinic-text">
                      <span className="w-1.5 h-1.5 rounded-full bg-clinic-gold flex-shrink-0" />
                      {pkg?.name ?? item.packageTypeId}
                    </li>
                  );
                })}
              </ul>

              {/* Order financials — right to left: סה"כ | שולם | יתרה לתשלום */}
              <div dir="rtl" className="grid grid-cols-3 gap-2 text-sm px-4 py-3 border-b border-clinic-border">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-clinic-muted">סה&quot;כ</span>
                  <span className="font-semibold text-clinic-text">
                    ₪{parseFloat(order.totalPrice).toLocaleString('he-IL')}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-clinic-muted">שולם</span>
                  <span className="font-medium text-clinic-text">
                    ₪{parseFloat(order.amountPaid).toLocaleString('he-IL')}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-clinic-muted">יתרה לתשלום</span>
                  <span className={`font-medium ${parseFloat(order.remainingBalance) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    ₪{parseFloat(order.remainingBalance).toLocaleString('he-IL')}
                  </span>
                </div>
              </div>

              {/* Payment count */}
              <div className="px-4 py-2 border-b border-clinic-border text-xs text-clinic-muted" dir="rtl">
                תשלומים: <span className="font-medium text-clinic-text">{order.paymentCount} מתוך {order.maxPaymentCount}</span>
              </div>

              {/* Payments */}
              {orderPayments.length > 0 && (
                <ul className="divide-y divide-clinic-border">
                  {orderPayments.map(payment => (
                    <li key={payment.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="text-xs text-clinic-muted">{formatDate(payment.paymentDate)}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-clinic-muted">{methodLabels[payment.method]}</span>
                        <span className="font-semibold text-clinic-text">
                          ₪{parseFloat(payment.amount).toLocaleString('he-IL')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {orderPayments.length === 0 && (
                <p className="text-xs text-clinic-muted text-center py-3">אין תשלומים עדיין</p>
              )}
            </div>
          );
        })}
      </div>

      {paymentModalOrderId && (
        <RecordPaymentModal
          open={true}
          onClose={() => setPaymentModalOrderId(null)}
          currentUser={currentUser}
          preselectedOrderId={paymentModalOrderId}
        />
      )}
    </>
  );
}
