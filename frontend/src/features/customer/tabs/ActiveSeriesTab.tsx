import { useState } from 'react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { useActiveTimer } from '../../../contexts/ActiveTimerContext';
import { usePackageTypes } from '../../../contexts/PackageTypesContext';
import { activeSeries, completedTreatmentsForSeries } from '../selectors';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { Badge } from '../../../components/shared/Badge';
import { ProgressBar } from '../../../components/shared/ProgressBar';
import { TreatmentSeries } from '../../../types/TreatmentSeries';
import { User } from '../../../types/User';
import { ApiRequestError } from '../../../api/apiError';

interface ActiveSeriesTabProps {
  currentUser: User;
}

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
      <span className="text-sm text-clinic-muted">{label}</span>
    </div>
  );
}

export function ActiveSeriesTab({ currentUser }: ActiveSeriesTabProps) {
  const { treatmentSeries, recordQuantityTreatment } = useCustomer();
  const timer = useActiveTimer();
  const { packageTypes } = usePackageTypes();
  const active = activeSeries(treatmentSeries);
  const [loadingSeriesId, setLoadingSeriesId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleMarkDone(seriesId: string) {
    setLoadingSeriesId(seriesId);
    setErrorMsg(null);
    try {
      await recordQuantityTreatment(seriesId, currentUser);
    } catch (e) {
      const msg = e instanceof ApiRequestError
        ? e.error.message
        : e instanceof Error ? e.message : 'שגיאה בשמירת הטיפול';
      setErrorMsg(msg);
    } finally {
      setLoadingSeriesId(null);
    }
  }

  if (active.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין חבילות פעילות. צור הזמנה כדי להתחיל.</p>
      </div>
    );
  }

  // A timer is "busy" when any timer is running or paused
  const timerBusy = timer.isRunning || timer.isPaused;

  return (
    <div className="p-6 flex flex-col gap-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 text-right">
          {errorMsg}
        </div>
      )}
      {active.map((s: TreatmentSeries, idx: number) => {
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
          unitLabel = 'טיפולים';
        }

        if (s.seriesKind === 'quantity') {
          const isSeriesComplete = (s.completedTreatments ?? 0) >= (s.totalTreatments ?? 0);

          return (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-clinic-border shadow-sm p-5 flex flex-col gap-4"
            >
              {/* Header: name + badge */}
              <div className="flex items-start justify-between">
                <Badge variant="active">פעיל</Badge>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-clinic-text">
                      {pkg?.name ?? s.packageTypeName ?? s.packageTypeId ?? ''}
                    </h3>
                    <span className="text-sm text-clinic-muted font-medium">#{s.packageNumber ?? idx + 1}</span>
                  </div>
                  {treatmentType && (
                    <span className="text-base text-clinic-muted">{treatmentType.name}</span>
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
                disabled={isSeriesComplete || loadingSeriesId === s.id}
                onClick={() => handleMarkDone(s.id)}
                className={`w-full py-2 text-sm border border-clinic-gold text-clinic-gold rounded-lg ${
                  isSeriesComplete || loadingSeriesId === s.id
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-clinic-gold hover:text-white transition-colors cursor-pointer'
                }`}
              >
                {loadingSeriesId === s.id ? 'שומר...' : 'סמן טיפול כבוצע'}
              </button>
            </div>
          );
        }

        // Timer series
        return (
          <div
            key={s.id}
            className="bg-white rounded-xl border border-clinic-border shadow-sm p-5 flex flex-col gap-4"
          >
            {/* Header: name + badge */}
            <div className="flex items-start justify-between">
              <Badge variant="active">פעיל</Badge>
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-clinic-text">
                    {pkg?.name ?? s.packageTypeName ?? s.packageTypeId ?? ''}
                  </h3>
                  <span className="text-sm text-clinic-muted font-medium">#{s.packageNumber ?? idx + 1}</span>
                </div>
                {treatmentType && (
                  <span className="text-base text-clinic-muted">{treatmentType.name}</span>
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

            {/* Progress bar + minutes per treatment */}
            <div className="flex flex-col gap-1">
              <ProgressBar value={progressValue} label={`${completed} מתוך ${total} ${unitLabel}`} />
              <div className="flex justify-end items-center gap-1">
                <span className="text-sm text-clinic-muted">דקות נוצלו</span>
                <span className="text-sm font-medium text-clinic-muted">{s.totalMinutes ?? 0}</span>
                <span className="text-sm text-clinic-muted">מתוך</span>
                <span className="text-sm font-medium text-clinic-muted">{s.usedMinutes ?? 0}</span>
              </div>
              {s.minutesPerTreatment && (
                <div className="flex justify-end items-center gap-1">
                  <span className="text-sm text-clinic-muted">דקות לטיפול</span>
                  <span className="text-sm font-medium text-clinic-muted">{s.minutesPerTreatment}</span>
                </div>
              )}
            </div>

            {/* Action button */}
            <button
              disabled={timerBusy}
              onClick={() => timer.selectAndStart(s.id)}
              className={`w-full py-2 text-sm border border-clinic-gold text-clinic-gold rounded-lg ${
                timerBusy
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-clinic-gold hover:text-white transition-colors cursor-pointer'
              }`}
            >
              התחל טיימר
            </button>
          </div>
        );
      })}
    </div>
  );
}
