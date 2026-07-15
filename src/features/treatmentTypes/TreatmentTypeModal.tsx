import { useState, useEffect } from 'react';
import { Modal } from '../../components/shared/Modal';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import type { TreatmentType } from '../../types/TreatmentType';

interface Props {
  open: boolean;
  onClose: () => void;
  initialValues?: TreatmentType;
}

export function TreatmentTypeModal({ open, onClose, initialValues }: Props) {
  const { createTreatmentType, updateTreatmentType } = useTreatmentTypes();
  const [name, setName] = useState('');
  const [durationStr, setDurationStr] = useState('60');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialValues?.name ?? '');
      setDurationStr(String(initialValues?.defaultDurationMinutes ?? 60));
      setError(null);
    }
  }, [open, initialValues]);

  const durationNum = parseInt(durationStr, 10);
  const isValid = name.trim().length > 0 && Number.isInteger(durationNum) && durationNum > 0;

  function handleSave() {
    if (!isValid) return;
    try {
      if (initialValues) {
        updateTreatmentType(initialValues.id, name, durationNum);
      } else {
        createTreatmentType(name, durationNum);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initialValues ? 'עריכת סוג טיפול' : 'הוספת סוג טיפול'}>
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            שם <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            maxLength={100}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="rtl"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            משך טיפול ברירת מחדל (דקות) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={durationStr}
            onChange={e => { setDurationStr(e.target.value); setError(null); }}
            min={1}
            step={1}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="ltr"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
        >
          ביטול
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          שמור
        </button>
      </div>
    </Modal>
  );
}
