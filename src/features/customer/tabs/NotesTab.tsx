import { useState } from 'react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { Modal } from '../../../components/shared/Modal';
import { therapists } from '../../../data/therapists';
import { treatmentTypes } from '../../../data/treatmentTypes';
import { Note } from '../../../types/Note';
import { formatDate } from '../../../utils/date';

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

interface NoteModalProps {
  note: Note;
  onClose: () => void;
}

function NoteModal({ note, onClose }: NoteModalProps) {
  const author = therapists.find(t => t.id === note.authorUserId);
  const treatmentType = note.treatmentTypeId
    ? treatmentTypes.find(t => t.id === note.treatmentTypeId)
    : null;

  return (
    <Modal open={true} onClose={onClose} title="הערה">
      <div className="flex flex-col gap-3 text-sm">
        {author && (
          <div className="flex justify-between">
            <span className="text-clinic-text">{author.fullName}</span>
            <span className="text-clinic-muted">מחברת</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-clinic-text">{formatDate(note.createdDate)}</span>
          <span className="text-clinic-muted">תאריך</span>
        </div>
        {treatmentType && (
          <div className="flex justify-between">
            <span className="text-clinic-text">{treatmentType.name}</span>
            <span className="text-clinic-muted">סוג טיפול</span>
          </div>
        )}
        <div className="mt-2">
          <p className="text-clinic-muted text-xs mb-1">תוכן ההערה</p>
          <p className="text-clinic-text bg-clinic-blush rounded-lg p-3 leading-relaxed">{note.text}</p>
        </div>
      </div>
    </Modal>
  );
}

export function NotesTab() {
  const { notes } = useCustomer();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const sorted = [...notes].sort((a, b) =>
    b.createdDate.localeCompare(a.createdDate)
  );

  if (sorted.length === 0) {
    return (
      <div className="p-6 text-center text-clinic-muted">
        <p>אין הערות.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-3">
      {sorted.map((note: Note) => {
        const author = therapists.find(t => t.id === note.authorUserId);
        const treatmentType = note.treatmentTypeId
          ? treatmentTypes.find(t => t.id === note.treatmentTypeId)
          : null;

        return (
          <div
            key={note.id}
            className="bg-clinic-blush rounded-xl shadow-sm p-4 flex items-start justify-between gap-4"
          >
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={() => setSelectedNote(note)}
                className="text-xs text-clinic-gold hover:underline font-medium"
              >
                קרא עוד
              </button>
            </div>

            <div className="flex flex-col items-end gap-1 flex-1">
              <div className="flex items-center gap-2 text-xs text-clinic-muted">
                {treatmentType && <span>{treatmentType.name}</span>}
                {author && <span>{author.fullName}</span>}
                <span>{formatDate(note.createdDate)}</span>
              </div>
              <p className="text-sm text-clinic-text text-right leading-relaxed">
                {truncate(note.text, 80)}
              </p>
            </div>
          </div>
        );
      })}

      {selectedNote && (
        <NoteModal note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}
    </div>
  );
}
