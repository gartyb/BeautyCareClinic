import { useState, useEffect } from 'react';
import { Modal } from '../../components/shared/Modal';
import { useCustomer } from '../../contexts/CustomerContext';
import { usePackageTypes } from '../../contexts/PackageTypesContext';
import { buildPayment } from './paymentService';
import { toCents } from '../../domain/money';
import { openOrders } from '../../features/customer/selectors';
import type { User } from '../../types/User';
import type { CustomerOrder, PaymentMethod } from '../../types/Order';

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User;
  preselectedOrderId?: string; // set when opened from per-order button
}

export function RecordPaymentModal({ open, onClose, currentUser, preselectedOrderId }: RecordPaymentModalProps) {
  const { orders, addPayment } = useCustomer();
  const { packageTypes } = usePackageTypes();
  const available = openOrders(orders);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    if (preselectedOrderId) return preselectedOrderId;
    if (available.length === 1) return available[0]?.id ?? '';
    return '';
  });
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [displayDate, setDisplayDate] = useState(() => {
    const t = new Date();
    return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
  });
  const [error, setError] = useState('');

  // Auto-select when available list changes to exactly one (FIX-7)
  useEffect(() => {
    if (!preselectedOrderId && available.length === 1 && !selectedOrderId) {
      setSelectedOrderId(available[0]?.id ?? '');
    }
  }, [available, preselectedOrderId, selectedOrderId]);

  // Pre-fill amount on last payment
  useEffect(() => {
    const order = orders.find(o => o.id === selectedOrderId);
    if (order && order.paymentCount === order.maxPaymentCount - 1) {
      setAmount(parseFloat(order.remainingBalance).toFixed(2));
    }
  }, [selectedOrderId, orders]);

  const sortedOrders = [...orders].sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const selectedOrderNumber = selectedOrder
    ? sortedOrders.length - sortedOrders.findIndex(o => o.id === selectedOrderId)
    : null;
  const needsOrderSelection = !preselectedOrderId && available.length > 1 && !selectedOrderId;
  const step = needsOrderSelection ? 'select-order' : 'payment-form';

  function getOrderLabel(order: CustomerOrder): string {
    const items = order.orderItems
      .map(oi => packageTypes.find(pt => pt.id === oi.packageTypeId)?.name ?? oi.packageTypeId)
      .join(', ');
    const num = sortedOrders.length - sortedOrders.findIndex(o => o.id === order.id);
    return `הזמנה #${num} — ${items}`;
  }

  function handleDateInput(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let display = digits;
    if (digits.length > 2) display = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 4) display = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    setDisplayDate(display);
    if (digits.length === 8) {
      setDate(`${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`);
    } else {
      setDate('');
    }
  }

  function handleClose() {
    // Reset to prop-driven default, not a stale computed value (FIX-7)
    setSelectedOrderId(preselectedOrderId ?? '');
    setAmount('');
    setMethod('Cash');
    const t = new Date();
    setDate(t.toISOString().slice(0, 10));
    setDisplayDate(`${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`);
    setError('');
    onClose();
  }

  const AMOUNT_REGEX = /^\d{1,7}(\.\d{1,2})?$/;
  const isLastPayment = !!selectedOrder && selectedOrder.paymentCount === selectedOrder.maxPaymentCount - 1;

  function handleSave() {
    if (!selectedOrder) return;
    // FIX-12: reject empty and future dates
    if (!date) { setError('יש לבחור תאריך'); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (date > today) { setError('לא ניתן לרשום תשלום בתאריך עתידי'); return; }
    // FIX-5: strict amount format validation
    if (!AMOUNT_REGEX.test(amount.trim()) || parseFloat(amount) <= 0) { setError('יש להזין סכום תקין'); return; }
    // FIX-5: use toCents for float-safe overpayment check
    if (toCents(amount.trim()) > toCents(selectedOrder.remainingBalance)) { setError('הסכום גבוה מהיתרה לתשלום'); return; }
    // Last payment must cover the full remaining balance
    if (isLastPayment && toCents(amount.trim()) < toCents(selectedOrder.remainingBalance)) {
      setError('בתשלום האחרון יש לשלם את כל היתרה');
      return;
    }
    const payment = buildPayment(selectedOrder.id, parseFloat(amount).toFixed(2), method, date, currentUser);
    addPayment(payment);
    handleClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="רשום תשלום">
      {step === 'select-order' ? (
        <div className="space-y-3">
          <p className="text-sm text-clinic-muted mb-2">בחרי הזמנה לתשלום:</p>
          {available.map(order => (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className="w-full text-right p-3 rounded-lg border border-clinic-border hover:border-clinic-gold hover:bg-clinic-bg text-sm"
            >
              <div className="font-medium text-clinic-text">{getOrderLabel(order)}</div>
              <div className="text-clinic-muted mt-1">יתרה: ₪{parseFloat(order.remainingBalance).toLocaleString('he-IL')}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {selectedOrder && (
            <div className="bg-clinic-blush rounded-xl border border-clinic-border p-4 flex flex-col gap-3 text-sm" dir="rtl">
              {/* Order number */}
              {selectedOrderNumber !== null && (
                <span className="text-xs font-semibold text-clinic-gold">הזמנה #{selectedOrderNumber}</span>
              )}
              {/* Package list */}
              <ul className="flex flex-col gap-1">
                {selectedOrder.orderItems.map(oi => {
                  const pkg = packageTypes.find(pt => pt.id === oi.packageTypeId);
                  return (
                    <li key={oi.id} className="flex items-center gap-1.5 text-clinic-text">
                      <span className="w-1.5 h-1.5 rounded-full bg-clinic-gold flex-shrink-0" />
                      {pkg?.name ?? oi.packageTypeId}
                    </li>
                  );
                })}
              </ul>
              {/* Financials row */}
              <div className="grid grid-cols-3 gap-2 border-t border-clinic-border pt-3 text-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-clinic-muted">סה&quot;כ</span>
                  <span className="font-semibold text-clinic-text">₪{parseFloat(selectedOrder.totalPrice).toLocaleString('he-IL')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-clinic-muted">שולם</span>
                  <span className="font-medium text-clinic-text">₪{parseFloat(selectedOrder.amountPaid).toLocaleString('he-IL')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-clinic-muted">יתרה</span>
                  <span className="font-semibold text-red-500">₪{parseFloat(selectedOrder.remainingBalance).toLocaleString('he-IL')}</span>
                </div>
              </div>
              {/* Payment count */}
              <div className="border-t border-clinic-border pt-3 text-xs text-clinic-muted">
                תשלומים: <span className="font-medium text-clinic-text">{selectedOrder.paymentCount} מתוך {selectedOrder.maxPaymentCount}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-clinic-muted mb-1">סכום (₪)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => { if (!isLastPayment) { setAmount(e.target.value); setError(''); } }}
              readOnly={isLastPayment}
              className={`w-full border border-clinic-border rounded-lg px-3 py-2 text-sm ${isLastPayment ? 'bg-clinic-bg text-clinic-muted cursor-not-allowed' : ''}`}
              placeholder="0.00"
            />
            {isLastPayment && (
              <p className="text-xs text-amber-600 mt-1">תשלום אחרון — חובה לשלם את מלוא היתרה</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-clinic-muted mb-1">אמצעי תשלום</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="w-full border border-clinic-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="Cash">מזומן</option>
              <option value="Credit Card">כרטיס אשראי</option>
              <option value="Bank Transfer">העברה בנקאית</option>
              <option value="Other">אחר</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-clinic-muted mb-1">תאריך תשלום</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              maxLength={10}
              value={displayDate}
              onChange={e => handleDateInput(e.target.value)}
              className="w-full border border-clinic-border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text">
              ביטול
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium hover:opacity-90"
            >
              שמור תשלום
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
