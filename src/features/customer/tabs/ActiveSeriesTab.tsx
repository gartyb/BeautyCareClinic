import { useCustomer } from '../../../contexts/CustomerContext';
import { activeSeries, completedTreatmentsForSeries } from '../selectors';
import { packageTypes } from '../../../data/packageTypes';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { Badge } from '../../../components/shared/Badge';
import { ProgressBar } from '../../../components/shared/ProgressBar';
import { TreatmentSeries } from '../../../types/TreatmentSeries';

interface StatProps {
  label: string;
  value: number;
  highlight?: 'gold' | 'muted';
}

function Stat({ label, value, highlight }: StatProps) {
  const valueClass =
    highlight === 'gold'
      ? 'text-clinic-gold'
      : highlight === 'muted'
        ? 'text-clinic-muted'
        : 'text-clinic-text';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-2xl font-bold ${valueClass}`}>{value}</span>
      <span className="text-xs text-clinic-muted">{label}</span>
    </div>
  );
}

export function ActiveSeriesTab() {
  const { treatmentSeries } = useCustomer();
  const active = activeSeries(treatmentSeries);

  if (active.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין סדרות פעילות. צור הזמנה כדי להתחיל.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {active.map((s: TreatmentSeries) => {
        const pkg = packageTypes.find(p => p.id === s.packageTypeId);
        const treatmentType = pkg
          ? treatmentTypes.find(t => t.id === pkg.treatmentTypeId)
          : null;

        let total = 0;
        let completed = 0;
        let remaining = 0;
        let progressValue = 0;
        let unitLabel = 'טיפולים';

        if (s.seriesKind === 'quantity') {
          total = s.totalTreatments ?? 0;
          completed = s.completedTreatments ?? 0;
          remaining = total - completed;
          progressValue = total > 0 ? completed / total : 0;
        } else {
          const perTreatment = s.minutesPerTreatment ?? 1;
          total = Math.floor((s.totalMinutes ?? 0) / perTreatment);
          completed = completedTreatmentsForSeries(s);
          remaining = total - completed;
          progressValue = (s.totalMinutes ?? 0) > 0
            ? (s.usedMinutes ?? 0) / (s.totalMinutes ?? 0)
            : 0;
          unitLabel = 'טיפולים (זמן)';
        }

        return (
          <div
            key={s.id}
            className="bg-white rounded-xl border border-clinic-border shadow-sm p-5 flex flex-col gap-4"
          >
            {/* Header: name + badge */}
            <div className="flex items-start justify-between">
              <Badge variant="active">פעיל</Badge>
              <div className="flex flex-col items-end gap-0.5">
                <h3 className="font-semibold text-clinic-text">
                  {pkg?.name ?? s.packageTypeId}
                </h3>
                {treatmentType && (
                  <span className="text-sm text-clinic-muted">{treatmentType.name}</span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex justify-around border-y border-clinic-border py-3">
              <Stat label="נרכשו" value={total} />
              <div className="w-px bg-clinic-border" />
              <Stat label="בוצעו" value={completed} highlight="muted" />
              <div className="w-px bg-clinic-border" />
              <Stat label="נותרו" value={remaining} highlight="gold" />
            </div>

            {/* Progress bar */}
            <ProgressBar value={progressValue} label={`${completed} מתוך ${total} ${unitLabel}`} />

            {/* Action button */}
            <button
              disabled
              title="זמין בקרוב"
              className="w-full py-2 text-sm border border-clinic-gold text-clinic-gold rounded-lg opacity-50 cursor-not-allowed"
            >
              {s.seriesKind === 'quantity' ? 'סמן טיפול כבוצע' : 'התחל טיימר'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
