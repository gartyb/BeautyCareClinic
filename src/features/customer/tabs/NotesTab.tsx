import { useState } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useCustomer } from '../../../contexts/CustomerContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Modal } from '../../../components/shared/Modal';
import { notesApi } from '../../../api/notesApi';
import { Note } from '../../../types/Note';
import { formatDate } from '../../../utils/date';
import { ApiRequestError } from '../../../api/apiError';

// ─── Helpers to normalise old mock data + new API data ────────────────────────

function getNoteContent(note: Note): string {
  return note.content ?? note.text ?? '';
}

function getNoteDate(note: Note): string {
  return note.noteDate ?? note.createdDate ?? '';
}

function getNoteAuthor(note: Note): string {
  return note.writtenByFullName ?? note.authorUserId ?? '';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

// ─── NoteModal — Add / Edit ───────────────────────────────────────────────────

interface NoteModalProps {
  mode: 'add' | 'edit';
  note?: Note;
  customerId: string;
  onClose: () => void;
  onSaved: () => void;
}

function NoteModal({ mode, note, customerId, onClose, onSaved }: NoteModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [content, setContent] = useState(
    mode === 'edit' ? (getNoteContent(note!) ) : ''
  );
  const [noteDate, setNoteDate] = useState(
    mode === 'edit' ? (getNoteDate(note!).slice(0, 10) || today) : today
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = content.trim().length > 0 && content.length <= 5000;
  const charCount = content.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'add') {
        await notesApi.create(customerId, { content: content.trim(), noteDate });
      } else {
        await notesApi.update(note!.id, { content: content.trim(), noteDate });
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.error.message);
      } else {
        setError('שגיאה בשמירת ההערה');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === 'add' ? 'הוסף הערה' : 'ערוך הערה';

  return (
    <Modal open={true} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" dir="rtl">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-clinic-muted">תאריך</label>
          <input
            type="date"
            value={noteDate}
            max={today}
            onChange={e => setNoteDate(e.target.value)}
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clinic-gold"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-clinic-muted">תוכן ההערה</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="כתבי את ההערה כאן..."
            dir="rtl"
            className="border border-clinic-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-clinic-gold"
          />
          <div className="flex justify-between text-xs text-clinic-muted">
            <span className={charCount > 5000 ? 'text-red-500' : ''}>{charCount} / 5000</span>
            {charCount > 5000 && <span className="text-red-500">חריגה ממגבלת התווים</span>}
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="px-4 py-2 text-sm rounded-lg bg-clinic-gold text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            {submitting ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── NoteDetailModal — View full note ────────────────────────────────────────

interface NoteDetailModalProps {
  note: Note;
  onClose: () => void;
}

function NoteDetailModal({ note, onClose }: NoteDetailModalProps) {
  const content = getNoteContent(note);
  const author  = getNoteAuthor(note);
  const date    = getNoteDate(note);

  return (
    <Modal open={true} onClose={onClose} title="הערה">
      <div className="flex flex-col gap-3 text-sm" dir="rtl">
        {author && (
          <div className="flex justify-between">
            <span className="text-clinic-text">{author}</span>
            <span className="text-clinic-muted">מחברת</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-clinic-text">{date ? formatDate(date) : ''}</span>
          <span className="text-clinic-muted">תאריך</span>
        </div>
        {note.treatmentTypeName && (
          <div className="flex justify-between">
            <span className="text-clinic-text">{note.treatmentTypeName}</span>
            <span className="text-clinic-muted">סוג טיפול</span>
          </div>
        )}
        <div className="mt-2">
          <p className="text-clinic-muted text-xs mb-1">תוכן ההערה</p>
          <p className="text-clinic-text bg-clinic-blush rounded-lg p-3 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </Modal>
  );
}

// ─── NoteRow ──────────────────────────────────────────────────────────────────

interface NoteRowProps {
  note: Note;
  currentUserId: string | undefined;
  isManager: boolean;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

function NoteRow({ note, currentUserId, isManager, onEdit, onDelete }: NoteRowProps) {
  const [expanded, setExpanded] = useState(false);
  const content = getNoteContent(note);
  const author  = getNoteAuthor(note);
  const date    = getNoteDate(note);

  const authorId = note.userId ?? note.authorUserId;
  const canEdit = authorId === currentUserId || isManager;

  const TRUNCATE_LENGTH = 200;
  const isTruncatable = content.length > TRUNCATE_LENGTH;

  return (
    <div className="bg-clinic-blush rounded-xl shadow-sm p-4 flex flex-col gap-2" dir="rtl">
      {/* Header row: metadata + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-clinic-muted flex-wrap">
          {note.treatmentTypeName && (
            <span className="bg-white px-2 py-0.5 rounded-full border border-clinic-border text-clinic-gold">
              {note.treatmentTypeName}
            </span>
          )}
          {author && <span>{author}</span>}
          {date && <span>{formatDate(date)}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(note)}
                title="ערוך הערה"
                className="p-1 text-clinic-muted hover:text-clinic-gold transition-colors"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => onDelete(note)}
                title="מחק הערה"
                className="p-1 text-clinic-muted hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-clinic-text leading-relaxed whitespace-pre-wrap">
        {expanded || !isTruncatable ? content : truncate(content, TRUNCATE_LENGTH)}
      </p>

      {/* Show more / less */}
      {isTruncatable && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-0.5 text-xs text-clinic-gold hover:underline self-start"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'הצג פחות' : 'קרא עוד'}
        </button>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function NotesTab() {
  const { notes, activeCustomer, refreshNotes } = useCustomer();
  const { currentUser } = useAuth();

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const triggerRefresh = refreshNotes;

  const isManager = currentUser?.role === 'Manager';

  const sorted = [...notes].sort((a, b) => {
    const da = getNoteDate(a);
    const db = getNoteDate(b);
    return db.localeCompare(da);
  });

  async function handleConfirmDelete() {
    if (!deletingNote) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await notesApi.delete(deletingNote.id);
      setDeletingNote(null);
      triggerRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setDeleteError(err.error.message);
      } else {
        setDeleteError('שגיאה במחיקת ההערה');
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!activeCustomer) return null;

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-clinic-muted">{sorted.length} הערות</span>
        <button
          onClick={() => setAddingNote(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-clinic-gold text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          הוסף הערה
        </button>
      </div>

      {/* Notes list */}
      {sorted.length === 0 ? (
        <div className="text-center text-clinic-muted py-8">
          <p>אין הערות עדיין.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((note: Note) => (
            <NoteRow
              key={note.id}
              note={note}
              currentUserId={currentUser?.id}
              isManager={isManager}
              onEdit={setEditingNote}
              onDelete={setDeletingNote}
            />
          ))}
        </div>
      )}

      {/* Add Note Modal */}
      {addingNote && (
        <NoteModal
          mode="add"
          customerId={activeCustomer.id}
          onClose={() => setAddingNote(false)}
          onSaved={triggerRefresh}
        />
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <NoteModal
          mode="edit"
          note={editingNote}
          customerId={activeCustomer.id}
          onClose={() => setEditingNote(null)}
          onSaved={triggerRefresh}
        />
      )}

      {/* View Note Detail Modal */}
      {viewingNote && (
        <NoteDetailModal
          note={viewingNote}
          onClose={() => setViewingNote(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingNote && (
        <Modal open={true} onClose={() => setDeletingNote(null)} title="מחיקת הערה">
          <div className="flex flex-col gap-4" dir="rtl">
            <p className="text-sm text-clinic-text">האם למחוק את ההערה? פעולה זו אינה הפיכה.</p>
            {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingNote(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-clinic-muted hover:text-clinic-text"
              >
                ביטול
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium disabled:opacity-40 hover:opacity-90"
              >
                {deleting ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
