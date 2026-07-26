import { DomainError } from '../../domain/errors';

/**
 * Validates and returns the new defaultMaxPaymentCount value.
 * Throws DomainError if value is not a positive integer.
 */
export function updateDefaultMaxPaymentCount(value: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > 24) {
    throw new DomainError(
      'SETTINGS_INVALID_MAX_PAYMENT_COUNT',
      'מספר תשלומים מקסימלי חייב להיות מספר שלם בין 1 ל-24'
    );
  }
  return value;
}
