import { Phone, Mail } from 'lucide-react';
import { useCustomer } from '../../contexts/CustomerContext';

function initials(firstName: string, lastName: string): string {
  return (firstName[0] ?? '') + (lastName[0] ?? '');
}

export function CustomerCardHeader() {
  const { activeCustomer } = useCustomer();

  if (!activeCustomer) return null;

  return (
    <div className="bg-white border-b border-clinic-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* RIGHT: avatar + name */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <h1 className="text-xl font-bold text-clinic-text">
              {activeCustomer.firstName} {activeCustomer.lastName}
            </h1>
          </div>
          <div className="w-12 h-12 rounded-full bg-clinic-pink flex items-center justify-center flex-shrink-0">
            <span className="text-base font-bold text-clinic-gold">
              {initials(activeCustomer.firstName, activeCustomer.lastName)}
            </span>
          </div>
        </div>

        {/* LEFT: phone + email */}
        <div className="flex flex-col gap-0.5 text-sm text-clinic-muted">
          <span className="flex items-center gap-1" dir="ltr">
            <Phone size={13} />
            {activeCustomer.phone}
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
