import { useCustomer } from '../../contexts/CustomerContext';
import { useActiveTimer } from '../../contexts/ActiveTimerContext';
import { activeSeries } from './selectors';
import { TreatmentSeries } from '../../types/TreatmentSeries';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimerPanel() {
  const { treatmentSeries } = useCustomer();
  const timer = useActiveTimer();

  const active = activeSeries(treatmentSeries).filter(
    (s: TreatmentSeries) => s.seriesKind === 'timer'
  );

  if (active.length === 0) return null;

  const statusLabel = timer.isRunning ? 'פעיל' : timer.isPaused ? 'מושהה' : 'לא פעיל';
  const displayTime = formatElapsed(timer.elapsedSeconds);

  return (
    <div className="bg-clinic-blush border-t border-clinic-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            disabled
            onClick={timer.reset}
            className="px-3 py-1.5 text-sm border border-clinic-gold text-clinic-gold rounded-lg opacity-50 cursor-not-allowed"
          >
            אפס
          </button>
          <button
            disabled
            onClick={timer.resume}
            className="px-3 py-1.5 text-sm border border-clinic-gold text-clinic-gold rounded-lg opacity-50 cursor-not-allowed"
          >
            המשך
          </button>
          <button
            disabled
            onClick={timer.pause}
            className="px-3 py-1.5 text-sm border border-clinic-gold text-clinic-gold rounded-lg opacity-50 cursor-not-allowed"
          >
            השהה
          </button>
          <button
            disabled
            onClick={timer.start}
            className="px-4 py-1.5 text-sm bg-clinic-gold text-white rounded-lg opacity-50 cursor-not-allowed font-medium"
          >
            התחל
          </button>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <h3 className="text-sm font-semibold text-clinic-text">טיימר טיפול</h3>
          <div className="flex items-center gap-3 text-clinic-muted text-sm">
            <span>{statusLabel}</span>
            <span className="text-xl font-mono font-bold text-clinic-text">{displayTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
