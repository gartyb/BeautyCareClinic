import { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Camera, X } from 'lucide-react';
import { Modal } from '../../../components/shared/Modal';
import { useCustomer } from '../../../contexts/CustomerContext';
import { buildTreatmentPhoto } from '../../treatment/treatmentService';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { therapists } from '../../../data/therapists';
import { Treatment, TreatmentPhoto } from '../../../types/Treatment';
import { formatDate } from '../../../utils/date';

interface TreatmentModalProps {
  treatment: Treatment;
  onClose: () => void;
}

// FIX-8: Strict allowlist — reject anything not in this set
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function TreatmentModal({ treatment, onClose }: TreatmentModalProps) {
  const { addTreatmentPhoto, removeTreatmentPhoto } = useCustomer();

  // Photo lightbox
  const [selectedPhoto, setSelectedPhoto] = useState<TreatmentPhoto | null>(null);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeName =
    treatmentTypes.find(t => t.id === treatment.treatmentTypeId)?.name
    ?? treatment.treatmentTypeName
    ?? treatment.treatmentTypeId;
  const therapist = therapists.find(t => t.id === (treatment.therapistId ?? treatment.userId));
  const therapistName = treatment.performedByFullName ?? therapist?.fullName;

  function handlePhotoButtonClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset after reading so user can re-select the same file
    if (!file) return;
    // FIX-8: Strict allowlist instead of startsWith('image/')
    if (!ALLOWED_TYPES.includes(file.type)) return;
    // FIX-8: Size limit 10 MB
    if (file.size > 10 * 1024 * 1024) return;
    try {
      const photoUrl = URL.createObjectURL(file);
      const photo = buildTreatmentPhoto(treatment.id, photoUrl);
      addTreatmentPhoto(treatment.id, photo);
    } catch (err) {
      console.error('[TreatmentModal] createObjectURL failed', err);
    }
  }


  // FIX-5: Lightbox rendered as a React portal to avoid stacking-context clipping
  const lightboxJSX = selectedPhoto ? (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      onClick={() => setSelectedPhoto(null)}
    >
      <button
        className="absolute top-4 left-4 text-white hover:text-gray-300 transition-colors"
        onClick={() => setSelectedPhoto(null)}
      >
        <X size={28} />
      </button>
      <img
        src={selectedPhoto.photoUrl}
        alt="תמונה מוגדלת"
        className="max-w-full max-h-full rounded-xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  ) : null;

  // When lightbox is open, closing the Modal should close the lightbox first
  function handleModalClose() {
    if (selectedPhoto) {
      setSelectedPhoto(null);
      return;
    }
    onClose();
  }

  return (
    <Modal open={true} onClose={handleModalClose} title="פרטי טיפול">
      {/* Basic info */}
      <div className="flex flex-col gap-3 text-base">
        <div className="flex items-center gap-2">
          <span className="text-clinic-muted">סוג טיפול:</span>
          <span className="text-clinic-text font-medium">{typeName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-clinic-muted">תאריך:</span>
          <span className="text-clinic-text">{formatDate(treatment.treatmentDate)}</span>
        </div>
        {therapistName && (
          <div className="flex items-center gap-2">
            <span className="text-clinic-muted">מטפלת:</span>
            <span className="text-clinic-text">{therapistName}</span>
          </div>
        )}
        {treatment.durationMinutes != null && treatment.durationMinutes > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-clinic-muted">משך:</span>
            <span className="text-clinic-text">{treatment.durationMinutes} דקות</span>
          </div>
        )}

        {/* Note — read-only (set at record time, no API for updating after creation) */}
        {treatment.notes && (
          <div className="mt-2">
            <p className="text-clinic-muted text-sm mb-1">הערות</p>
            <p className="text-clinic-text bg-clinic-blush rounded-lg p-3">{treatment.notes}</p>
          </div>
        )}

        {/* Photo button */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={handlePhotoButtonClick}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-clinic-gold text-clinic-gold rounded-lg text-xs font-medium hover:bg-clinic-blush transition-colors"
          >
            <Camera size={13} />
            <span>הוסף תמונה</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Photo thumbnail grid — FIX-4: null-guard on treatmentPhotos */}
      {(treatment.treatmentPhotos ?? []).length > 0 && (
        <div className="mt-4">
          <p className="text-clinic-muted text-sm mb-2">תמונות</p>
          <div className="grid grid-cols-3 gap-2">
            {(treatment.treatmentPhotos ?? []).map((photo: TreatmentPhoto) => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden aspect-square group">
                <button
                  onClick={() => setSelectedPhoto(photo)}
                  className="w-full h-full"
                >
                  <img
                    src={photo.photoUrl}
                    alt="תמונת טיפול"
                    className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                  />
                </button>
                <button
                  onClick={() => removeTreatmentPhoto(treatment.id, photo.id)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIX-5: Lightbox rendered via portal to document.body */}
      {lightboxJSX && ReactDOM.createPortal(lightboxJSX, document.body)}
    </Modal>
  );
}
