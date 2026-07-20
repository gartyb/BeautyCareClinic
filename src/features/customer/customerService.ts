import type { Customer } from '../../types/Customer';
import { newId } from '../../domain/id';
import { DomainError } from '../../domain/errors';

interface BuildCustomerDeps {
  newId?: () => string;
  today?: () => string;
}

/**
 * Builds a Customer entity from raw input.
 * Throws DomainError for invalid inputs.
 */
export function buildCustomer(
  fullName: string,
  phone: string,
  email?: string,
  deps: BuildCustomerDeps = {}
): Customer {
  if (!fullName.trim()) {
    throw new DomainError('CUSTOMER_NAME_REQUIRED', 'שם הלקוחה לא יכול להיות ריק');
  }
  if (fullName.trim().length > 80) {
    throw new DomainError('CUSTOMER_NAME_TOO_LONG', 'שם לא יכול לעלות על 80 תווים');
  }
  if (!phone.trim()) {
    throw new DomainError('CUSTOMER_PHONE_REQUIRED', 'מספר הטלפון לא יכול להיות ריק');
  }
  if (!/^\d{7,10}$/.test(phone.trim())) {
    throw new DomainError('CUSTOMER_PHONE_INVALID', 'מספר טלפון לא תקין — יש להזין 7–10 ספרות');
  }
  if (email && email.trim()) {
    const trimmedEmail = email.trim();
    if (!/.+@.+\..+/.test(trimmedEmail) || trimmedEmail.length > 120) {
      throw new DomainError('CUSTOMER_EMAIL_INVALID', 'כתובת אימייל לא תקינה');
    }
  }

  const genId = deps.newId ?? newId;
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  return {
    id: genId(),
    fullName: fullName.trim(),
    phone: phone.trim(),
    email: email?.trim() ?? '',
    createdDate: today(),
    // A brand-new customer definitionally has no series or orders yet (matches the backend's
    // CustomersController.Create, which returns 0/null without a query).
    activeSeriesCount: 0,
    outstandingBalance: null,
  };
}
