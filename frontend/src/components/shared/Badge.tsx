import React from 'react';
import { clsx } from 'clsx';

interface Props {
  variant: 'success' | 'warning' | 'error' | 'neutral' | 'active';
  children: React.ReactNode;
}

const variantClasses: Record<Props['variant'], string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-600',
  active: 'bg-clinic-pink text-clinic-text',
};

export function Badge({ variant, children }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant]
      )}
    >
      {children}
    </span>
  );
}
