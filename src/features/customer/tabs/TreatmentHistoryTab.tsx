import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { usePackageTypes } from '../../../contexts/PackageTypesContext';
import { TreatmentModal } from './TreatmentModal';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { therapists } from '../../../data/therapists';
import { Treatment } from '../../../types/Treatment';
import { OrderItem } from '../../../types/Order';
import { formatDate } from '../../../utils/date';


// ─── Package row with optional expandable treatments ─────────────────────────

interface PackageRowProps {
  item: OrderItem;
  orderDate: string;
  seriesTreatments: Treatment[];
}

function PackageRow({ item, orderDate, seriesTreatments }: PackageRowProps) {
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
            const therapist = therapists.find(th => th.id === t.therapistId);
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-clinic-blush transition-colors cursor-pointer"
                onClick={() => setSelectedTreatmentId(t.id)}
              >
                <span className="text-sm text-clinic-muted w-5 text-center flex-shrink-0">{idx + 1}</span>
                <div className="flex flex-col items-start gap-0.5 flex-1">
                  <span className="text-base font-medium text-clinic-text">{formatDate(t.treatmentDate)}</span>
                  <div className="flex items-center gap-2 text-sm text-clinic-muted">
                    {therapist && <span>{therapist.fullName}</span>}
                    {t.durationMinutes != null && t.durationMinutes > 0 && (
                      <span>{t.durationMinutes} דק׳</span>
                    )}
                  </div>
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
  const { orders, treatments } = useCustomer();

  // Flatten orderItems, each carrying its order's createdDate, sorted newest first
  const flatItems = orders
    .flatMap(order => (order.orderItems ?? []).map(item => ({ item, orderDate: order.createdDate ?? '' })))
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
