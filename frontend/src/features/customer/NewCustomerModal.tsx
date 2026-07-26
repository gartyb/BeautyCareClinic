import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/shared/Modal';
import { useCustomers } from '../../contexts/CustomersContext';
import { ApiRequestError } from '../../api/apiError';
import { parsePhone } from '../../utils/phone';

interface NewCustomerModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewCustomerModal({ open, onClose }: NewCustomerModalProps) {
  const { createCustomer } = useCustomers();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isValid = fullName.trim().length > 0 && phone.trim().length > 0;

  function handleClose() {
    setFullName('');
    setPhone('');
    setEmail('');
    setSaveError(null);
    onClose();
  }

  async function handleSave() {
    if (!isValid) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const newCustomer = await createCustomer(fullName, phone, email || undefined);
      handleClose();
      navigate('/customers/' + newCustomer.id);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setSaveError(e.message);
      } else if (e instanceof Error) {
        setSaveError(e.message);
      } else {
        setSaveError('שגיאה לא צפויה');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="לקוחה חדשה">
      <div className="space-y-4">
        {saveError && (
          <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            שם מלא <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="שם פרטי ושם משפחה"
            maxLength={80}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="rtl"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            טלפון <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(parsePhone(e.target.value))}
            placeholder="0500000000"
            maxLength={10}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="ltr"
            inputMode="numeric"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-clinic-text mb-1">
            אימייל
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            maxLength={120}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-clinic-gold"
            dir="ltr"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={handleClose}
          className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
        >
          ביטול
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          {isSaving ? 'שומר...' : 'שמור לקוחה'}
        </button>
      </div>
    </Modal>
  );
}
