import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { useAuth } from '../../../contexts/AuthContext';
import { usePackageTypes } from '../../../contexts/PackageTypesContext';
import { TreatmentModal } from './TreatmentModal';
import { Modal } from '../../../components/shared/Modal';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { therapists } from '../../../data/therapists';
import { treatmentsApi } from '../../../api/treatmentsApi';
import { Treatment } from '../../../types/Treatment';
import { OrderItem } from '../../../types/Order';
import { formatDate, formatTime } from '../../../utils/date';
import { ApiRequestError } from '../../../api/apiError';

/** Returns the therapist display name from a Treatment, supporting both old mock and API data. */
function getTherapistName(t: Treatment): string {
  if (t.performedByFullName) return t.performedByFullName;
  const therapist = therapists.find(th => th.id === (t.therapistId ?? t.userId));
  return therapist?.fullName ?? '';
}


// ─── Package row with optional expandable treatments ─────────────────────────

interface PackageRowProps {
  item: OrderItem;
  orderDate: string;
  packageIndex: number;
  seriesTreatments: Treatment[];
  currentUserId: string | undefined;
  isManager: boolean;
  onDeleteTreatment: (id: string) => void;
}

function PackageRow({ item, orderDate, packageIndex, seriesTreatments, currentUserId, isManager, onDeleteTreatment }: PackageRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);
  const { packageTypes } = usePackageTypes();
  const selectedTreatment = selectedTreatmentId
    ? (seriesTreatments.find(t => t.id === selectedTreatmentId) ?? null)
    : null;
  const pkg = packageTypes.find(p => p.id === item.packageTypeId);
  const treatmentType = pkg ? treatmentTypes.find(t => t.id === pkg.treatmentTypeId) : null;
  const hasTreatments = seriesTreatments.length > 0;

  return (
    <div className="bg-white rounded-xl border border-clinic-border shadow-sm overflow-hidden">
      {/* Package header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-clinic-blush transition-colors"
        onClick={() => hasTreatments && setExpanded(v => !v)}
        disabled={!hasTreatments}
      >
        <div className="flex items-center gap-2 text-clinic-muted text-base">
          {hasTreatments && (
            expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
          )}
          <span className="font-medium text-clinic-muted">#{packageIndex}</span>
          <span>{formatDate(orderDate)}</span>
          {hasTreatments && (
            <span className="text-sm bg-clinic-blush text-clinic-gold border border-clinic-gold/30 px-2 py-0.5 rounded-full">
              {seriesTreatments.length} טיפולים
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-semibold text-clinic-text text-base">{pkg?.name ?? item.packageTypeId}</span>
          {treatmentType && (
            <span className="text-sm text-clinic-muted">{treatmentType.name}</span>
          )}
        </div>
      </button>

      {/* Treatment rows */}
      {hasTreatments && expanded && (
        <ul dir="rtl" className="border-t border-clinic-border divide-y divide-clinic-border">
          {seriesTreatments.map((t, idx) => {
            const therapistName = getTherapistName(t);
            const authorId = t.userId ?? t.therapistId;
            const canDelete = authorId === currentUserId || isManager;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-clinic-blush transition-colors"
              >
                <span className="text-sm text-clinic-muted w-5 text-center flex-shrink-0">{idx + 1}</span>
                <div
                  className="flex flex-col items-start gap-0.5 flex-1 cursor-pointer"
                  onClick={() => setSelectedTreatmentId(t.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-clinic-text">{formatDate(t.treatmentDate)}</span>
                    <span className="text-sm text-clinic-muted">{formatTime(t.treatmentDate)}</span>
                    {t.durationMinutes != null && t.durationMinutes > 0 && (
                      <span className="text-sm font-medium text-clinic-gold">{t.durationMinutes} דק׳</span>
                    )}
                  </div>
                  {therapistName && (
                    <span className="text-sm text-clinic-muted">{therapistName}</span>
                  )}
                  {t.notes && (
                    <span className="text-sm text-clinic-muted">{t.notes}</span>
                  )}
                </div>
                {(t.treatmentPhotos ?? []).length > 0 && (
                  <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                    {(t.treatmentPhotos ?? []).map(p => (
                      <img
                        key={p.id}
                        src={p.photoUrl}
                        alt="תמונת טיפול"
                        className="w-10 h-10 rounded-md object-cover border border-clinic-border"
                      />
                    ))}
                  </div>
                )}
                {canDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteTreatment(t.id); }}
                    title="מחק טיפול"
                    className="p-1.5 text-clinic-muted hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectedTreatment && (
        <TreatmentModal
          treatment={selectedTreatment}
          onClose={() => setSelectedTreatmentId(null)}
        />
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function TreatmentHistoryTab() {
  const { orders, treatments, refreshTreatments } = useCustomer();
  const { currentUser } = useAuth();

  const [deletingTreatmentId, setDeletingTreatmentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isManager = currentUser?.role === 'Manager';

  // Flatten orderItems, each carrying its order's date, sorted newest first
  const flatItems = orders
    .flatMap(order => (order.items ?? order.orderItems ?? []).map(item => ({
      item,
      orderDate: order.orderDate ?? order.createdDate ?? '',
    })))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  async function handleConfirmDelete() {
    if (!deletingTreatmentId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await treatmentsApi.delete(deletingTreatmentId);
      setDeletingTreatmentId(null);
      await refreshTreatments();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setDeleteError(err.error.message);
      } else {
        setDeleteError('שגיאה במחיקת הטיפול');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (flatItems.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין היסטוריית טיפולים.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-3">
      {flatItems.map(({ item, orderDate }, idx) => {
        const seriesId = item.treatmentSeriesId ?? item.seriesId;
        const seriesTreatments = seriesId
          ? [...treatments.filter(t => t.treatmentSeriesId === seriesId)]
              .sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate))
          : [];

        return (
          <PackageRow
            key={item.id}
            item={item}
            orderDate={orderDate}
            packageIndex={idx + 1}
            seriesTreatments={seriesTreatments}
            currentUserId={currentUser?.id}
            isManager={isManager}
            onDeleteTreatment={setDeletingTreatmentId}
          />
        );
      })}

      {/* Delete Confirm Modal */}
      {deletingTreatmentId && (
        <Modal open={true} onClose={() => setDeletingTreatmentId(null)} title="מחיקת טיפול">
          <div className="flex flex-col gap-4" dir="rtl">
            <p className="text-sm text-clinic-text">האם למחוק את הטיפול? פעולה זו תבטל את עדכון הסדרה ואינה הפיכה.</p>
            {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingTreatmentId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium disabled:opacity-40 hover:opacity-90"
              >
                {isDeleting ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
