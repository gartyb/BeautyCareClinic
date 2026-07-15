import type { Customer } from '../../types/Customer';
import { newId } from '../../domain/id';
import { DomainError } from '../../domain/errors';

interface BuildCustomerDeps {
  newId?: () => string;
  today?: () => string;
}

/**
 * Builds a Customer entity from raw input.
 * fullName is split on the first space into firstName + lastName.
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

  const trimmedName = fullName.trim();
  const spaceIndex = trimmedName.indexOf(' ');
  const firstName = spaceIndex === -1 ? trimmedName : trimmedName.slice(0, spaceIndex);
  const lastName = spaceIndex === -1 ? '' : trimmedName.slice(spaceIndex + 1).trim();

  return {
    id: genId(),
    firstName,
    lastName,
    phone: phone.trim(),
    email: email?.trim() ?? '',
    createdDate: today(),
  };
}
