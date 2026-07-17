import { DomainError } from './errors';

export function toCents(s: string | number): number {
  const n = typeof s === 'number' ? s : parseFloat(s);
  if (isNaN(n)) throw new DomainError('INVALID_AMOUNT', `Invalid monetary value: "${s}"`);
  return Math.round(n * 100);
}
export function fromCents(n: number): string {
  return (Math.round(n) / 100).toFixed(2);
}
