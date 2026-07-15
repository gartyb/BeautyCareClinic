import React, { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useTreatmentTypes } from '../../contexts/TreatmentTypesContext';
import type { PackageType } from '../../types/PackageType';
import { PackageTypeModal } from './PackageTypeModal';
import { usePackageTypes } from '../../contexts/PackageTypesContext';

export function PackagesScreen() {
  const { packageTypes, createPackageType, updatePackageType, deletePackageType } = usePackageTypes();
  const { treatmentTypes } = useTreatmentTypes();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PackageType | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(undefined);
    setModalOpen(true);
  }

  function openEdit(pkg: PackageType) {
    setEditTarget(pkg);
    setModalOpen(true);
  }

  // The modal builds a PackageType via buildPackageType (with validation) and returns it.
  // For edits we pass the built object to the context updater.
  // For creates the modal already produced a valid object; we call createPackageType with
  // the same params so the context owns the canonical state (the modal's generated id is
  // intentionally discarded — no persistence yet, ids are ephemeral in this session).
  function handleModalSave(pkg: PackageType) {
    if (editTarget) {
      updatePackageType(editTarget.id, pkg);
    } else {
      createPackageType({
        name: pkg.name,
        treatmentTypeId: pkg.treatmentTypeId,
        price: pkg.price,
        isSeries: pkg.isSeries,
        treatmentCount: pkg.treatmentCount,
        isTimerBased: pkg.isTimerBased,
        minutesPerTreatment: pkg.minutesPerTreatment,
      });
    }
  }

  function handleConfirmDelete(id: string) {
    deletePackageType(id);
    setDeletingId(null);
  }

  function getTreatmentTypeName(id: string): string {
    return treatmentTypes.find(tt => tt.id === id)?.name ?? id;
  }

  return (
    <div className="flex-1 bg-clinic-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-clinic-text">סוגי חבילות</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus size={18} />
            <span>יצירת חבילה חדשה</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-clinic-border bg-clinic-blush text-clinic-muted text-xs">
                <th className="text-right px-4 py-3 font-medium">שם</th>
                <th className="text-right px-4 py-3 font-medium">סוג טיפול</th>
                <th className="text-right px-4 py-3 font-medium">מחיר</th>
                <th className="text-right px-4 py-3 font-medium">סוג</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {packageTypes.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-clinic-muted py-12">
                    אין חבילות. לחץ על "יצירת חבילה חדשה" להוספה.
                  </td>
                </tr>
              )}
              {packageTypes.map(pkg => (
                <React.Fragment key={pkg.id}>
                  <tr className="border-b border-clinic-border hover:bg-clinic-bg transition-colors">
                    <td className="px-4 py-3 font-medium text-clinic-text">{pkg.name}</td>
                    <td className="px-4 py-3 text-clinic-muted">{getTreatmentTypeName(pkg.treatmentTypeId)}</td>
                    <td className="px-4 py-3 text-clinic-text">
                      ₪{parseFloat(pkg.price).toLocaleString('he-IL')}
                    </td>
                    <td className="px-4 py-3 text-clinic-muted">
                      {!pkg.isSeries ? 'טיפול בודד' : pkg.isTimerBased ? 'סדרה (טיימר)' : 'סדרה (כמות)'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(pkg)}
                          className="text-clinic-muted hover:text-clinic-text p-1 rounded"
                          title="עריכה"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingId(pkg.id)}
                          className="text-clinic-muted hover:text-red-500 p-1 rounded"
                          title="מחיקה"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {deletingId === pkg.id && (
                    <tr className="bg-red-50 border-b border-clinic-border">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-4 text-sm" dir="rtl">
                          <span className="text-clinic-text">
                            למחוק את <strong>{pkg.name}</strong>?
                          </span>
                          <button
                            onClick={() => handleConfirmDelete(pkg.id)}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PackageTypeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
        initialValues={editTarget}
      />
    </div>
  );
}
