import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Camera, FileText, Trash2, X } from 'lucide-react';
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
  const { updateTreatmentNote, addTreatmentPhoto, removeTreatmentPhoto } = useCustomer();

  // Photo lightbox
  const [selectedPhoto, setSelectedPhoto] = useState<TreatmentPhoto | null>(null);

  // Note editing
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(treatment.notes ?? '');

  // FIX-2: Sync noteText when treatment.notes prop changes
  useEffect(() => {
    setNoteText(treatment.notes ?? '');
  }, [treatment.notes]);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeName =
    treatmentTypes.find(t => t.id === treatment.treatmentTypeId)?.name ?? treatment.treatmentTypeId;
  const therapist = therapists.find(t => t.id === treatment.therapistId);

  function handleSaveNote() {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    updateTreatmentNote(treatment.id, trimmed);
    setEditingNote(false);
  }

  function handleCancelNote() {
    setNoteText(treatment.notes ?? '');
    setEditingNote(false);
  }

  // FIX-1: Delete note handler
  function handleDeleteNote() {
    updateTreatmentNote(treatment.id, '');
    setEditingNote(false);
  }

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

  const hasNote = !!treatment.notes;
  const noteButtonLabel = hasNote ? 'ערוך הערה' : 'הוסף הערה';
  const canSaveNote = noteText.trim().length > 0;

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
        {therapist && (
          <div className="flex items-center gap-2">
            <span className="text-clinic-muted">מטפלת:</span>
            <span className="text-clinic-text">{therapist.fullName}</span>
          </div>
        )}
        {treatment.durationMinutes != null && treatment.durationMinutes > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-clinic-muted">משך:</span>
            <span className="text-clinic-text">{treatment.durationMinutes} דקות</span>
          </div>
        )}

        {/* Note display (when not editing) */}
        {treatment.notes && !editingNote && (
          <div className="mt-2">
            <p className="text-clinic-muted text-sm mb-1">הערות</p>
            <p className="text-clinic-text bg-clinic-blush rounded-lg p-3">{treatment.notes}</p>
          </div>
        )}

        {/* Note editing area */}
        {editingNote ? (
          <div className="mt-2">
            <p className="text-clinic-muted text-sm mb-1">הערה</p>
            {/* FIX-10: maxLength on note textarea */}
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full border border-clinic-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-clinic-gold"
              placeholder="הזיני הערה לגבי הטיפול..."
              dir="rtl"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={handleCancelNote}
                className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
              >
                ביטול
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!canSaveNote}
                className="px-4 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              >
                שמור הערה
              </button>
            </div>
          </div>
        ) : (
          // FIX-7: Note buttons and photo button/input are always rendered together
          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={() => setEditingNote(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-clinic-gold text-clinic-gold rounded-lg text-xs font-medium hover:bg-clinic-blush transition-colors"
            >
              <FileText size={13} />
              <span>{noteButtonLabel}</span>
            </button>
            {/* FIX-1: Delete note button — shown only when a note exists */}
            {hasNote && (
              <button
                onClick={handleDeleteNote}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
                <span>מחק הערה</span>
              </button>
            )}
            {/* FIX-7: Photo button always present alongside note buttons */}
            <button
              onClick={handlePhotoButtonClick}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-clinic-gold text-clinic-gold rounded-lg text-xs font-medium hover:bg-clinic-blush transition-colors"
            >
              <Camera size={13} />
              <span>הוסף תמונה</span>
            </button>
            {/* FIX-8: Strict accept attribute; FIX-9: value reset moved to top of handleFileChange */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}
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
