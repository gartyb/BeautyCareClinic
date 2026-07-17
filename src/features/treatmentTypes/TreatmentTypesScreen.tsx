import React, { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import { usePackageTypes } from '../../contexts/PackageTypesContext';
import { useTherapistData } from '../../contexts/TherapistDataContext';
import { TreatmentTypeModal } from './TreatmentTypeModal';
import type { TreatmentType } from '../../types/TreatmentType';

export function TreatmentTypesScreen() {
  const { treatmentTypes, deleteTreatmentType } = useTreatmentTypes();
  const { packageTypes } = usePackageTypes();
  const { capabilities } = useTherapistData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TreatmentType | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(undefined);
    setModalOpen(true);
  }

  function openEdit(tt: TreatmentType) {
    setEditTarget(tt);
    setModalOpen(true);
  }

  function getUsageInfo(id: string): { inUse: boolean; label: string } {
    const pkgCount = packageTypes.filter(p => p.treatmentTypeId === id).length;
    const therapistCount = new Set(
      capabilities.filter(c => c.treatmentTypeId === id).map(c => c.userId)
    ).size;
    if (pkgCount === 0 && therapistCount === 0) return { inUse: false, label: '' };
    const parts: string[] = [];
    if (pkgCount > 0) parts.push(`${pkgCount} חבילות`);
    if (therapistCount > 0) parts.push(`${therapistCount} מטפלות`);
    return { inUse: true, label: `בשימוש ב-${parts.join(' ו-')}` };
  }

  return (
    <div className="flex-1 bg-clinic-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-clinic-text">סוגי טיפולים</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus size={18} />
            <span>הוספת סוג טיפול</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-clinic-border bg-clinic-blush text-clinic-muted text-xs">
                <th className="text-right px-4 py-3 font-medium">שם</th>
                <th className="text-right px-4 py-3 font-medium">שימוש</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {treatmentTypes.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-clinic-muted py-12">
                    אין סוגי טיפולים. לחץ על "הוספת סוג טיפול" להוספה.
                  </td>
                </tr>
              )}
              {treatmentTypes.map(tt => {
                const usage = getUsageInfo(tt.id);
                return (
                  <React.Fragment key={tt.id}>
                    <tr className="border-b border-clinic-border hover:bg-clinic-bg transition-colors">
                      <td className="px-4 py-3 font-medium text-clinic-text">{tt.name}</td>
                      <td className="px-4 py-3 text-clinic-muted text-xs">
                        {usage.inUse ? usage.label : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(tt)}
                            className="text-clinic-muted hover:text-clinic-text p-1 rounded"
                            title="עריכה"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => !usage.inUse && setDeletingId(tt.id)}
                            disabled={usage.inUse}
                            className="text-clinic-muted hover:text-red-500 p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title={usage.inUse ? `לא ניתן למחוק — ${usage.label}` : 'מחיקה'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {deletingId === tt.id && (
                      <tr className="bg-red-50 border-b border-clinic-border">
                        <td colSpan={3} className="px-4 py-3">
                          <div className="flex items-center gap-4 text-sm" dir="rtl">
                            <span className="text-clinic-text">
                              למחוק את <strong>{tt.name}</strong>?
                            </span>
                            <button
                              onClick={() => { void deleteTreatmentType(tt.id).then(() => setDeletingId(null)); }}
                              className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium"
                            >
                              מחק
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-3 py-1 rounded-lg text-clinic-muted hover:text-clinic-text text-sm"
                            >
                              ביטול
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <TreatmentTypeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialValues={editTarget}
      />
    </div>
  );
}
