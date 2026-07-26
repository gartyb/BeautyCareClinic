import { useState, useEffect } from 'react';
import { Modal } from '../../components/shared/Modal';
import { useTherapists } from '../../contexts/TherapistsContext';
import { parsePhone } from '../../utils/phone';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY = { fullName: '', email: '', phone: '', password: '' };

export function TherapistModal({ open, onClose }: Props) {
  const { createTherapist } = useTherapists();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
      setIsSaving(false);
    }
  }, [open]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError(null);
  }

  const isValid = form.fullName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.password.trim().length > 0;

  async function handleSave() {
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await createTherapist(form.fullName, form.email, form.phone, form.password);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה לא צפויה');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="הוספת מטפלת">
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            שם מלא <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
            maxLength={100}
            placeholder="שם פרטי ושם משפחה"
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="rtl"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-clinic-text mb-1">
              אימייל <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              maxLength={100}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clinic-text mb-1">
              טלפון <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => set('phone', parsePhone(e.target.value))}
              placeholder="0500000000"
              maxLength={10}
              className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
              dir="ltr"
              inputMode="numeric"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            סיסמה <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="לפחות 8 תווים, אות גדולה, אות קטנה, ספרה ותו מיוחד"
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="ltr"
            autoComplete="new-password"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text disabled:opacity-40"
        >
          ביטול
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          {isSaving ? 'שומר...' : 'הוסף מטפלת'}
        </button>
      </div>
    </Modal>
  );
}
