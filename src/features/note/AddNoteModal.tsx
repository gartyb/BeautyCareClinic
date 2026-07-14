import { useState } from 'react';
import { Modal } from '../../components/shared/Modal';
import { useCustomer } from '../../contexts/CustomerContext';
import { buildNote } from './noteService';
import type { User } from '../../types/User';

interface AddNoteModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  currentUser: User;
}

export function AddNoteModal({ open, onClose, customerId, currentUser }: AddNoteModalProps) {
  const { addNote } = useCustomer();
  const [text, setText] = useState('');

  const canSave = text.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const note = buildNote(customerId, text.trim(), currentUser.id);
    addNote(note);
    setText('');
    onClose();
  }

  function handleClose() {
    setText('');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="הוסף הערה">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-clinic-muted mb-1">תוכן ההערה</label>
          {/* FIX-10: maxLength prevents oversized note submissions */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full border border-clinic-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-clinic-gold"
            placeholder="הזיני הערה לגבי הלקוחה..."
            dir="rtl"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            שמור הערה
          </button>
        </div>
      </div>
    </Modal>
  );
}
