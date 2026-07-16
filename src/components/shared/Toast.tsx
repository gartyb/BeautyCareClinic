import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-clinic-text text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
      <CheckCircle size={18} className="text-clinic-gold flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
