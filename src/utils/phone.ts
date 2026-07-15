export function parsePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return d;
}
