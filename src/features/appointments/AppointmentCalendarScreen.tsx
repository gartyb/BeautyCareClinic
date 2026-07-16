import { useState, useRef } from 'react';
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import { useAppointments } from '../../contexts/AppointmentsContext';
import { CalendarGrid } from './components/CalendarGrid';
import { BookAppointmentModal } from './BookAppointmentModal';

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function formatDate(date: Date): string {
  const weekday = WEEKDAY_NAMES[date.getDay()];
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `${weekday}, ${dd}/${mm}/${yyyy}`;
}

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AppointmentCalendarScreen() {
  const { appointments } = useAppointments();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showBookModal, setShowBookModal] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  function toInputValue(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function handleDatePick(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const [y, m, day] = e.target.value.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    setSelectedDate(d);
  }

  return (
    <div className="flex-1 bg-clinic-bg flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-clinic-border px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="p-2 rounded-lg hover:bg-clinic-bg text-clinic-muted hover:text-clinic-text transition-colors"
            title="יום הבא"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setSelectedDate(today())}
            className="px-3 py-1.5 text-sm border border-clinic-border rounded-lg hover:bg-clinic-bg text-clinic-muted transition-colors"
          >
            היום
          </button>
          <button
            onClick={() => setSelectedDate(d => addDays(d, -1))}
            className="p-2 rounded-lg hover:bg-clinic-bg text-clinic-muted hover:text-clinic-text transition-colors"
            title="יום קודם"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="relative">
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className="flex items-center gap-2 text-lg font-bold text-clinic-text hover:text-clinic-gold transition-colors"
              title="בחר תאריך"
            >
              {formatDate(selectedDate)}
              <Calendar size={16} className="text-clinic-muted" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={toInputValue(selectedDate)}
              onChange={handleDatePick}
              aria-label="בחר תאריך"
              className="absolute top-full right-0 opacity-0 pointer-events-none w-0 h-0"
            />
          </div>
        </div>

        <button
          onClick={() => setShowBookModal(true)}
          className="px-4 py-2 bg-clinic-gold text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          קבע תור חדש
        </button>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        <CalendarGrid selectedDate={selectedDate} appointments={appointments} />
      </div>

      <BookAppointmentModal
        open={showBookModal}
        onClose={() => setShowBookModal(false)}
      />
    </div>
  );
}
