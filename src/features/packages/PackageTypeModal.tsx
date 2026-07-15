import { useState, useEffect } from 'react';
import { Modal } from '../../components/shared/Modal';
import { buildPackageType } from './packageTypeService';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import type { PackageType } from '../../types/PackageType';

interface PackageTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (pkg: PackageType) => void;
  initialValues?: PackageType;
}

const EMPTY_FORM = {
  name: '',
  treatmentTypeId: '',
  price: '',
  isSeries: false,
  treatmentCount: '',
  isTimerBased: false,
  minutesPerTreatment: '',
};

export function PackageTypeModal({ open, onClose, onSave, initialValues }: PackageTypeModalProps) {
  const { treatmentTypes } = useTreatmentTypes();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setForm({
          name: initialValues.name,
          treatmentTypeId: initialValues.treatmentTypeId,
          price: initialValues.price,
          isSeries: initialValues.isSeries,
          treatmentCount: initialValues.treatmentCount?.toString() ?? '',
          isTimerBased: initialValues.isTimerBased ?? false,
          minutesPerTreatment: initialValues.minutesPerTreatment?.toString() ?? '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setError(null);
    }
  }, [open, initialValues]);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError(null);
  }

  const isValid =
    form.name.trim().length > 0 &&
    form.treatmentTypeId.trim().length > 0 &&
    (!form.isSeries || (parseInt(form.treatmentCount, 10) > 0)) &&
    (!form.isTimerBased || (parseInt(form.minutesPerTreatment, 10) > 0)) &&
    (!form.isTimerBased || form.isSeries);

  function handleSave() {
    if (!isValid) return;
    try {
      const pkg = buildPackageType({
        name: form.name,
        treatmentTypeId: form.treatmentTypeId,
        price: form.price || '0',
        isSeries: form.isSeries,
        treatmentCount: form.isSeries ? parseInt(form.treatmentCount, 10) : undefined,
        isTimerBased: form.isSeries ? form.isTimerBased : false,
        minutesPerTreatment: form.isTimerBased ? parseInt(form.minutesPerTreatment, 10) : undefined,
      });
      // preserve id if editing
      const finalPkg = initialValues ? { ...pkg, id: initialValues.id } : pkg;
      onSave(finalPkg);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initialValues ? 'עריכת חבילה' : 'יצירת חבילה חדשה'}>
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
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="rtl"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            סוג טיפול <span className="text-red-400">*</span>
          </label>
          <select
            value={form.treatmentTypeId}
            onChange={e => set('treatmentTypeId', e.target.value)}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="rtl"
          >
            <option value="">בחר סוג טיפול</option>
            {treatmentTypes.map(tt => (
              <option key={tt.id} value={tt.id}>{tt.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">מחיר (₪)</label>
          <input
            type="number"
            min={0}
            value={form.price}
            onChange={e => set('price', e.target.value)}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="ltr"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isSeries"
            checked={form.isSeries}
            onChange={e => {
              const checked = e.target.checked;
              setForm(prev => ({
                ...prev,
                isSeries: checked,
                ...(checked ? {} : { isTimerBased: false }),
              }));
              setError(null);
            }}
            className="w-4 h-4 accent-clinic-gold"
          />
          <label htmlFor="isSeries" className="text-sm font-medium text-clinic-text">האם סדרה?</label>
        </div>

        {form.isSeries && (
          <div>
            <label className="block text-sm font-medium text-clinic-text mb-1">
              מספר טיפולים <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.treatmentCount}
              onChange={e => set('treatmentCount', e.target.value)}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
            />
          </div>
        )}

        {form.isSeries && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isTimerBased"
              checked={form.isTimerBased}
              onChange={e => set('isTimerBased', e.target.checked)}
              className="w-4 h-4 accent-clinic-gold"
            />
            <label htmlFor="isTimerBased" className="text-sm font-medium text-clinic-text">מבוסס טיימר?</label>
          </div>
        )}

        {form.isTimerBased && form.isSeries && (
          <div>
            <label className="block text-sm font-medium text-clinic-text mb-1">
              דקות לטיפול <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.minutesPerTreatment}
              onChange={e => set('minutesPerTreatment', e.target.value)}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
            />
          </div>
        )}
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
