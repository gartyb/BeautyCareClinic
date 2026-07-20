import { CustomerOrder } from '../../types/Order';
import { TreatmentSeries } from '../../types/TreatmentSeries';
import { Appointment } from '../../types/Appointment';
import { Payment } from '../../types/Payment';
import { toCents } from '../../domain/money';
import { localNow } from '../appointments/appointmentService';

// Sum of remainingBalance across open orders (remainingBalance > 0)
export function outstandingBalance(orders: CustomerOrder[]): number {
  const totalCents = orders
    .filter(o => toCents(o.remainingBalance) > 0)
    .reduce((sum, o) => sum + toCents(o.remainingBalance), 0);
  return Math.round(totalCents) / 100;
}

// Series where all treatments are not yet completed
export function activeSeries(series: TreatmentSeries[]): TreatmentSeries[] {
  return series.filter(s => {
    if (s.seriesKind === 'quantity') {
      return (s.completedTreatments ?? 0) < (s.totalTreatments ?? 0);
    }
    return (s.usedMinutes ?? 0) < (s.totalMinutes ?? 0);
  });
}

// floor(usedMinutes / minutesPerTreatment)
export function completedTreatmentsForSeries(series: TreatmentSeries): number {
  if (series.seriesKind !== 'timer') return series.completedTreatments ?? 0;
  if (!series.minutesPerTreatment || series.minutesPerTreatment <= 0) return 0;
  return Math.floor((series.usedMinutes ?? 0) / series.minutesPerTreatment);
}

// Most recent past appointment
export function previousAppointment(appointments: Appointment[]): Appointment | null {
  // Appointment.startTime is a naive Israel-local ISO string (no `Z` suffix — Phase 011
  // storage convention). Comparing it against `new Date().toISOString()` (UTC-suffixed) is a
  // timezone mismatch that misclassifies appointments during the Israel/UTC offset window every
  // day (same bug class as FU-019). Use the naive-local "now" instead, matching
  // appointmentService.ts's `localNow()` (the frontend counterpart to the backend's
  // `GetIsraelLocalNow()`).
  const now = localNow();
  const past = appointments
    .filter(a => a.startTime < now && a.status === 'Completed')
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  return past[0] ?? null;
}

// Earliest future scheduled appointment
export function nextAppointment(appointments: Appointment[]): Appointment | null {
  const now = localNow();
  const future = appointments
    .filter(a => a.startTime >= now && a.status === 'Scheduled')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return future[0] ?? null;
}

export function totalPaid(payments: Payment[]): number {
  return Math.round(payments.reduce((sum, p) => sum + toCents(p.amount), 0)) / 100;
}

export function remainingUnits(series: TreatmentSeries[]): number {
  return activeSeries(series).reduce((sum, s) => {
    if (s.seriesKind === 'quantity') {
      return sum + ((s.totalTreatments ?? 0) - (s.completedTreatments ?? 0));
    }
    const perTreatment = s.minutesPerTreatment ?? 1;
    return sum + Math.floor(((s.totalMinutes ?? 0) - (s.usedMinutes ?? 0)) / perTreatment);
  }, 0);
}

export function openOrders(orders: CustomerOrder[]): CustomerOrder[] {
  return orders.filter(o => toCents(o.remainingBalance) > 0 && o.paymentCount < o.maxPaymentCount);
}

export function paymentsForOrder(payments: Payment[], orderId: string): Payment[] {
  return payments.filter(p => (p.orderId ?? p.customerOrderId) === orderId);
}
