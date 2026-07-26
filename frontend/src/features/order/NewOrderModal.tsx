import { useState } from 'react';
import { Modal } from '../../components/shared/Modal';
import { RoleGuard } from '../../components/shared/RoleGuard';
import { useCustomer } from '../../contexts/CustomerContext';
import { useGlobalSettings } from '../../contexts/GlobalSettingsContext';
import { usePackageTypes } from '../../contexts/PackageTypesContext';
import { ApiRequestError } from '../../api/apiError';
import type { User } from '../../types/User';

interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  currentUser: User;
}

export function NewOrderModal({ open, onClose, customerId, currentUser }: NewOrderModalProps) {
  const { addOrder } = useCustomer();
  const { defaultMaxPaymentCount } = useGlobalSettings();
  const { packageTypes } = usePackageTypes();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxOverride, setMaxOverride] = useState<number>(defaultMaxPaymentCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (selected.size === 0) return;
    const effectiveMax = currentUser.role === 'Manager' ? maxOverride : undefined;
    if (currentUser.role === 'Manager' && (!Number.isInteger(effectiveMax) || (effectiveMax as number) < 1 || (effectiveMax as number) > 24)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await addOrder(customerId, [...selected], effectiveMax);
      setSelected(new Set());
      setMaxOverride(defaultMaxPaymentCount);
      onClose();
    } catch (e) {
      const msg = e instanceof ApiRequestError
        ? e.error.message
        : e instanceof Error ? e.message : 'שגיאה ביצירת ההזמנה';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const selectedPkgs = packageTypes.filter(pt => selected.has(pt.id));
  const total = selectedPkgs.reduce((sum, pt) => sum + parseFloat(String(pt.price)), 0);

  return (
    <Modal open={open} onClose={onClose} title="הזמנה חדשה">
      <div className="space-y-3">
        {packageTypes.length === 0 && (
          <p className="text-sm text-clinic-muted text-center py-4">טוען חבילות...</p>
        )}
        {packageTypes.map(pt => (
          <label key={pt.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-clinic-bg">
            <input
              type="checkbox"
              checked={selected.has(pt.id)}
              onChange={() => toggle(pt.id)}
              className="w-4 h-4 accent-clinic-gold"
            />
            <span className="flex-1 text-clinic-text">{pt.name}</span>
            <span className="text-clinic-muted text-sm">₪{parseFloat(String(pt.price)).toLocaleString('he-IL')}</span>
          </label>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mt-4 pt-4 border-t border-clinic-border flex justify-between text-sm font-medium">
          <span className="text-clinic-text">סה"כ</span>
          <span className="text-clinic-gold">₪{total.toLocaleString('he-IL')}</span>
        </div>
      )}

      <RoleGuard user={currentUser} role="Manager">
        <div className="mt-4">
          <label className="block text-sm text-clinic-muted mb-1">מקסימום תשלומים</label>
          <input
            type="number"
            min={1}
            max={24}
            value={maxOverride}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              setMaxOverride(Number.isFinite(v) && v >= 1 ? Math.min(v, 24) : defaultMaxPaymentCount);
            }}
            className="w-24 border border-clinic-border rounded-lg px-2 py-1 text-sm text-center"
          />
        </div>
      </RoleGuard>

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-right">{error}</div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text disabled:opacity-50">
          ביטול
        </button>
        <button
          onClick={handleSave}
          disabled={selected.size === 0 || loading}
          className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          {loading ? 'שומר...' : 'שמור הזמנה'}
        </button>
      </div>
    </Modal>
  );
}
