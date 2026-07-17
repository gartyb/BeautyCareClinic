import type { CustomerOrder } from '../../types/Order';
import type { Payment } from '../../types/Payment';
import type { User } from '../../types/User';
import { DomainError } from '../../domain/errors';
import { newId } from '../../domain/id';
import { toCents, fromCents } from '../../domain/money';

interface BuildPaymentDeps {
  newId?: () => string;
  now?: () => string;
}

export function buildPayment(
  orderId: string,
  amount: string | number,
  method: string,
  paymentDate: string,
  currentUser: User,
  deps: BuildPaymentDeps = {}
): Payment {
  const genId = deps.newId ?? newId;
  const now = deps.now ?? (() => new Date().toISOString());
  return {
    id: genId(),
    customerOrderId: orderId,
    orderId,
    amount,
    method,
    paymentMethod: method,
    paymentDate,
    createdDate: now(),
    createdByUserId: currentUser.id,
  };
}

export function applyPaymentToOrder(order: CustomerOrder, payment: Payment): CustomerOrder {
  if (order.paymentCount >= order.maxPaymentCount) {
    throw new DomainError('PAYMENT_COUNT_EXCEEDED', 'תשלום נדחה: הגעת למספר התשלומים המקסימלי');
  }
  const total = order.discountedPrice ?? order.totalPrice ?? order.originalPrice
    ?? fromCents(toCents(order.remainingBalance) + toCents(order.amountPaid));
  const paidCents = toCents(order.amountPaid) + toCents(payment.amount);
  const totalCents = toCents(total);
  if (paidCents > totalCents) {
    throw new DomainError('OVERPAYMENT', 'הסכום גבוה מהיתרה לתשלום');
  }
  const remainingCents = totalCents - paidCents;
  return {
    ...order,
    amountPaid: fromCents(paidCents),
    remainingBalance: fromCents(remainingCents),
    paymentCount: order.paymentCount + 1,
  };
}
