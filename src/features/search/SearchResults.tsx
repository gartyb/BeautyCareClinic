import { useNavigate } from 'react-router-dom';
import { CustomerSummary } from '../../types/Customer';
import { treatmentSeries } from '../../data/series';
import { appointments } from '../../data/appointments';
import { orders } from '../../data/orders';
import { activeSeries, outstandingBalance, nextAppointment } from '../customer/selectors';
import { formatDate } from '../../utils/date';
import { formatPhone } from '../../utils/phone';

interface Props {
  results: CustomerSummary[];
  query: string;
}

function initials(firstName: string, lastName: string): string {
  return (firstName[0] ?? '') + (lastName[0] ?? '');
}

export function SearchResults({ results, query }: Props) {
  const navigate = useNavigate();

  if (results.length === 0 && query.trim()) {
    return (
      <div className="text-center text-clinic-muted py-12">
        <p className="text-lg">לא נמצאו לקוחות התואמות את החיפוש</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm" dir="rtl">
      <thead>
        <tr className="border-b border-clinic-border bg-clinic-blush text-clinic-muted text-xs">
          <th className="text-right px-4 py-3 font-medium">לקוחה</th>
          <th className="text-center px-4 py-3 font-medium">סדרות פעילות</th>
          <th className="text-center px-4 py-3 font-medium">יתרת חוב</th>
          <th className="text-center px-4 py-3 font-medium">תור הבא</th>
        </tr>
      </thead>
      <tbody>
        {results.map(customer => {
          const customerSeries = treatmentSeries.filter(s => s.customerId === customer.id);
          const activeCount = activeSeries(customerSeries).length;

          const customerOrders = orders.filter(o => o.customerId === customer.id);
          const balance = outstandingBalance(customerOrders);

          const customerAppts = appointments.filter(a => a.customerId === customer.id);
          const next = nextAppointment(customerAppts);

          return (
            <tr
              key={customer.id}
              onClick={() => navigate(`/customers/${customer.id}`)}
              className="border-b border-clinic-border hover:bg-clinic-blush transition-colors cursor-pointer"
            >
              {/* שם + טלפון */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-clinic-pink flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-clinic-gold">
                      {initials(customer.firstName, customer.lastName)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-clinic-text">
                      {customer.firstName} {customer.lastName}
                    </span>
                    <span className="text-xs text-clinic-muted" dir="ltr">{formatPhone(customer.phone)}</span>
                  </div>
                </div>
              </td>

              {/* סדרות פעילות */}
              <td className="px-4 py-3 text-center">
                {activeCount > 0 ? (
                  <span className="text-xs bg-clinic-blush text-clinic-gold border border-clinic-gold/30 px-2 py-0.5 rounded-full font-medium">
                    {activeCount}
                  </span>
                ) : (
                  <span className="text-clinic-muted">—</span>
                )}
              </td>

              {/* יתרת חוב */}
              <td className="px-4 py-3 text-center font-semibold">
                {balance > 0 ? (
                  <span className="text-red-500">₪{balance.toLocaleString('he-IL')}</span>
                ) : (
                  <span className="text-green-600 text-xs">שולם</span>
                )}
              </td>

              {/* תור הבא */}
              <td className="px-4 py-3 text-center text-clinic-text">
                {next ? formatDate(next.appointmentDateTime) : (
                  <span className="text-clinic-muted">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
