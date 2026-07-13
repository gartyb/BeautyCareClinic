import { useCustomer } from '../../../contexts/CustomerContext';
import { Badge } from '../../../components/shared/Badge';
import { CustomerOrder } from '../../../types/Order';
import { Payment } from '../../../types/Payment';
import { packageTypes } from '../../../data/packageTypes';

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
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

export function OrdersTab() {
  const { orders, payments } = useCustomer();

  const sorted = [...orders].sort((a, b) => b.createdDate.localeCompare(a.createdDate));

  if (sorted.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין הזמנות. לחץ &apos;הזמנה חדשה&apos; להתחיל.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {sorted.map((order: CustomerOrder) => {
        const status = getPaymentStatus(order);
        const orderPayments = [...payments.filter(p => p.customerOrderId === order.id)]
          .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

        return (
          <div key={order.id} className="bg-white rounded-xl border border-clinic-border shadow-sm overflow-hidden">

            {/* Order header */}
            <div className="flex items-center justify-between px-4 py-3 bg-clinic-blush">
              <div className="flex items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                <button
                  disabled
                  title="זמין בקרוב"
                  className="px-2.5 py-1 text-xs border border-clinic-gold text-clinic-gold rounded-lg opacity-50 cursor-not-allowed"
                >
                  רשום תשלום
                </button>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-medium text-clinic-text">
                  הזמנה {order.id.replace('order-', '#')}
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
  );
}
