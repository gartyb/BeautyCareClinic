import { Phone, Mail } from 'lucide-react';
import { useCustomer } from '../../contexts/CustomerContext';
import { formatPhone } from '../../utils/phone';

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export function CustomerCardHeader() {
  const { activeCustomer } = useCustomer();

  if (!activeCustomer) return null;

  return (
    <div className="bg-white border-b border-clinic-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* RIGHT: avatar → name */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-clinic-pink flex items-center justify-center flex-shrink-0">
            <span className="text-base font-bold text-clinic-gold">
              {initials(activeCustomer.fullName)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-clinic-text">
            {activeCustomer.fullName}
          </h1>
        </div>

        {/* LEFT: phone + email */}
        <div className="flex flex-col gap-0.5 text-sm text-clinic-muted">
          <span className="flex items-center gap-1" dir="ltr">
            <Phone size={13} />
            {formatPhone(activeCustomer.phone)}
          </span>
          <span className="flex items-center gap-1" dir="ltr">
            <Mail size={13} />
            {activeCustomer.email}
          </span>
        </div>
      </div>
    </div>
  );
}
