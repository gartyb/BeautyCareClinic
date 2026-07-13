interface Props {
  value: number; // 0–1
  label?: string;
}

export function ProgressBar({ value, label }: Props) {
  const clampedValue = Math.min(1, Math.max(0, value));
  const percentage = Math.round(clampedValue * 100);

  return (
    <div className="w-full">
      <div className="w-full bg-clinic-border rounded-full h-2 overflow-hidden">
        <div
          className="bg-clinic-gold h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {label && (
        <p className="text-xs text-clinic-muted mt-1" dir="rtl">{label}</p>
      )}
    </div>
  );
}
