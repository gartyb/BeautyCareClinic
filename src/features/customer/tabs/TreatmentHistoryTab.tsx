import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { packageTypes } from '../../../data/packageTypes';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { therapists } from '../../../data/therapists';
import { Treatment, TreatmentPhoto } from '../../../types/Treatment';
import { OrderItem } from '../../../types/Order';

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '...';
}

// ─── Treatment detail modal ───────────────────────────────────────────────────

interface ModalProps {
  treatment: Treatment;
  onClose: () => void;
}

function TreatmentModal({ treatment, onClose }: ModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<TreatmentPhoto | null>(null);
  const typeName =
    treatmentTypes.find(t => t.id === treatment.treatmentTypeId)?.name ?? treatment.treatmentTypeId;
  const therapist = therapists.find(t => t.id === treatment.therapistId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="p-1 text-clinic-muted hover:text-clinic-text rounded-lg">
            <X size={20} />
          </button>
          <h2 className="text-lg font-bold text-clinic-text">פרטי טיפול</h2>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-clinic-text font-medium">{typeName}</span>
            <span className="text-clinic-muted">סוג טיפול</span>
          </div>
          <div className="flex justify-between">
            <span className="text-clinic-text">{formatDate(treatment.treatmentDate)}</span>
            <span className="text-clinic-muted">תאריך</span>
          </div>
          {therapist && (
            <div className="flex justify-between">
              <span className="text-clinic-text">{therapist.firstName} {therapist.lastName}</span>
              <span className="text-clinic-muted">מטפלת</span>
            </div>
          )}
          {treatment.durationMinutes != null && treatment.durationMinutes > 0 && (
            <div className="flex justify-between">
              <span className="text-clinic-text">{treatment.durationMinutes} דקות</span>
              <span className="text-clinic-muted">משך</span>
            </div>
          )}
          {treatment.notes && (
            <div className="mt-2">
              <p className="text-clinic-muted text-xs mb-1">הערות</p>
              <p className="text-clinic-text bg-clinic-blush rounded-lg p-3">{treatment.notes}</p>
            </div>
          )}
        </div>

        {treatment.treatmentPhotos.length > 0 && (
          <div className="mt-4">
            <p className="text-clinic-muted text-xs mb-2">תמונות</p>
            <div className="grid grid-cols-3 gap-2">
              {treatment.treatmentPhotos.map((photo: TreatmentPhoto) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="rounded-lg overflow-hidden aspect-square"
                >
                  <img src={photo.photoUrl} alt="תמונת טיפול" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPhoto && (
          <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
            <img src={selectedPhoto.photoUrl} alt="תמונה מוגדלת" className="max-w-full max-h-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Package row with optional expandable treatments ─────────────────────────

interface PackageRowProps {
  item: OrderItem;
  orderDate: string;
  seriesTreatments: Treatment[];
}

function PackageRow({ item, orderDate, seriesTreatments }: PackageRowProps) {
  const [expanded, setExpanded] = useState(true);
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
        <div className="flex items-center gap-2 text-clinic-muted text-sm">
          {hasTreatments && (
            expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />
          )}
          <span>{formatDate(orderDate)}</span>
          {hasTreatments && (
            <span className="text-xs bg-clinic-blush text-clinic-gold border border-clinic-gold/30 px-2 py-0.5 rounded-full">
              {seriesTreatments.length} טיפולים
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-semibold text-clinic-text">{pkg?.name ?? item.packageTypeId}</span>
          {treatmentType && (
            <span className="text-xs text-clinic-muted">{treatmentType.name}</span>
          )}
        </div>
      </button>

      {/* Treatment rows */}
      {hasTreatments && expanded && (
        <ul dir="rtl" className="border-t border-clinic-border divide-y divide-clinic-border">
          {seriesTreatments.map((t, idx) => {
            const therapist = therapists.find(th => th.id === t.therapistId);
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-clinic-blush transition-colors">
                <span className="text-xs text-clinic-muted w-5 text-center flex-shrink-0">{idx + 1}</span>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium text-clinic-text">{formatDate(t.treatmentDate)}</span>
                  <div className="flex items-center gap-2 text-xs text-clinic-muted">
                    {therapist && <span>{therapist.firstName} {therapist.lastName}</span>}
                    {t.durationMinutes != null && t.durationMinutes > 0 && (
                      <span>{t.durationMinutes} דק׳</span>
                    )}
                  </div>
                  {t.notes && (
                    <span className="text-xs text-clinic-muted">{truncate(t.notes, 50)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function TreatmentHistoryTab() {
  const { orders, treatments } = useCustomer();

  // Flatten orderItems, each carrying its order's createdDate, sorted newest first
  const flatItems = orders
    .flatMap(order => order.orderItems.map(item => ({ item, orderDate: order.createdDate })))
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  if (flatItems.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין היסטוריית טיפולים.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-3">
      {flatItems.map(({ item, orderDate }) => {
        const seriesTreatments = item.treatmentSeriesId
          ? [...treatments.filter(t => t.treatmentSeriesId === item.treatmentSeriesId)]
              .sort((a, b) => b.treatmentDate.localeCompare(a.treatmentDate))
          : [];

        return (
          <PackageRow
            key={item.id}
            item={item}
            orderDate={orderDate}
            seriesTreatments={seriesTreatments}
          />
        );
      })}

    </div>
  );
}
