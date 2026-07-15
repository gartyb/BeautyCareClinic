import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { useTherapists } from '../../contexts/TherapistsContext';
import { useTherapistData } from '../../contexts/TherapistDataContext';
import { TherapistModal } from './TherapistModal';
import { formatPhone } from '../../utils/phone';
import type { User } from '../../types/User';

export function TherapistsScreen() {
  const navigate = useNavigate();
  const { therapists, deleteTherapist } = useTherapists();
  const { cleanupTherapist } = useTherapistData();

  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleConfirmDelete(user: User) {
    cleanupTherapist(user.id);
    deleteTherapist(user.id);
    setDeletingId(null);
  }

  return (
    <div className="flex-1 bg-clinic-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-clinic-text">מטפלות</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-clinic-gold text-white hover:opacity-90 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus size={18} />
            <span>הוספת מטפלת</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {therapists.length === 0 && (
            <div className="text-center text-clinic-muted py-12">
              לא נמצאו מטפלות
            </div>
          )}
          {therapists.map(user => (
            <div key={user.id}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-clinic-border hover:bg-clinic-bg transition-colors">
                <div
                  className="flex flex-col gap-0.5 flex-1 cursor-pointer"
                  onClick={() => navigate(`/therapists/${user.id}`)}
                >
                  <span className="font-semibold text-clinic-text">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="text-sm text-clinic-muted" dir="ltr">{user.email}</span>
                  {user.phone && (
                    <span className="text-sm text-clinic-muted" dir="ltr">{formatPhone(user.phone)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeletingId(user.id)}
                    className="text-clinic-muted hover:text-red-500 p-1 rounded"
                    title="מחיקה"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronLeft
                    size={18}
                    className="text-clinic-muted cursor-pointer"
                    onClick={() => navigate(`/therapists/${user.id}`)}
                  />
                </div>
              </div>
              {deletingId === user.id && (
                <div className="flex items-center gap-4 px-6 py-3 bg-red-50 border-b border-clinic-border text-sm" dir="rtl">
                  <span className="text-clinic-text">
                    למחוק את <strong>{user.firstName} {user.lastName}</strong>? שעות עבודה, תאריכים ויכולות יימחקו.
                  </span>
                  <button
                    onClick={() => handleConfirmDelete(user)}
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
              )}
            </div>
          ))}
        </div>
      </div>

      <TherapistModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
