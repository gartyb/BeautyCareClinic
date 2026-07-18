import { useCustomer } from '../../contexts/CustomerContext';
import { useActiveTimer } from '../../contexts/ActiveTimerContext';
import { usePackageTypes } from '../../contexts/PackageTypesContext';
import { activeSeries } from './selectors';
import { TreatmentSeries } from '../../types/TreatmentSeries';
import { User } from '../../types/User';

interface TimerPanelProps {
  currentUser: User;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimerPanel({ currentUser }: TimerPanelProps) {
  const { treatmentSeries, recordTimerTreatment } = useCustomer();
  const timer = useActiveTimer();
  const { packageTypes } = usePackageTypes();

  const active = activeSeries(treatmentSeries).filter(
    (s: TreatmentSeries) => s.seriesKind === 'timer'
  );

  if (active.length === 0) return null;

  const activeSeries_ = timer.targetSeriesId
    ? treatmentSeries.find(s => s.id === timer.targetSeriesId)
    : null;
  const activeSeriesName = activeSeries_
    ? (packageTypes.find(p => p.id === activeSeries_.packageTypeId)?.name
        ?? activeSeries_.packageTypeName
        ?? activeSeries_.packageTypeId)
    : null;

  const statusLabel = timer.isRunning ? 'פעיל' : timer.isPaused ? 'מושהה' : 'לא פעיל';
  const displayTime = formatElapsed(timer.elapsedSeconds);

  const canPause = timer.isRunning;
  const canResume = timer.isPaused;
  const canReset = timer.isRunning || timer.isPaused || timer.elapsedSeconds > 0;
  const canEnd = (timer.isRunning || timer.isPaused) && timer.elapsedSeconds > 0;

  function endTreatment() {
    const snapshot = timer.endAndGetElapsed();
    if (!snapshot) return;
    recordTimerTreatment(snapshot.seriesId, snapshot.elapsedSeconds, currentUser);
  }

  return (
    <div className="bg-clinic-blush border-t border-clinic-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            disabled={!canReset}
            onClick={timer.reset}
            className={`px-3 py-1.5 text-sm border border-clinic-gold text-clinic-gold rounded-lg ${
              canReset ? 'hover:bg-clinic-gold hover:text-white transition-colors cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            אפס
          </button>
          <button
            disabled={!canResume}
            onClick={timer.resume}
            className={`px-3 py-1.5 text-sm border border-clinic-gold text-clinic-gold rounded-lg ${
              canResume ? 'hover:bg-clinic-gold hover:text-white transition-colors cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            המשך
          </button>
          <button
            disabled={!canPause}
            onClick={timer.pause}
            className={`px-3 py-1.5 text-sm border border-clinic-gold text-clinic-gold rounded-lg ${
              canPause ? 'hover:bg-clinic-gold hover:text-white transition-colors cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            השהה
          </button>
          <button
            disabled={!canEnd}
            onClick={endTreatment}
            className={`px-4 py-1.5 text-sm bg-clinic-text text-white rounded-lg font-medium ${
              canEnd ? 'hover:opacity-90 transition-opacity cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            סיים טיפול
          </button>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <h3 className="text-sm font-semibold text-clinic-text">
            {activeSeriesName ?? 'טיימר טיפול'}
          </h3>
          <div className="flex items-center gap-3 text-clinic-muted text-sm">
            <span>{statusLabel}</span>
            <span className="text-xl font-mono font-bold text-clinic-text">{displayTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
