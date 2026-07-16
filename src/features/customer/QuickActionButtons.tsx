import { useState } from 'react';
import { PlusCircle, DollarSign, Calendar, MessageSquare } from 'lucide-react';
import { useCustomer } from '../../contexts/CustomerContext';
import { openOrders } from './selectors';
import { NewOrderModal } from '../order/NewOrderModal';
import { RecordPaymentModal } from '../payment/RecordPaymentModal';
import { AddNoteModal } from '../note/AddNoteModal';
import { BookAppointmentModal } from '../appointments/BookAppointmentModal';
import type { User } from '../../types/User';

interface QuickActionButtonsProps {
  currentUser: User;
  customerId: string;
}

export function QuickActionButtons({ currentUser, customerId }: QuickActionButtonsProps) {
  const { orders } = useCustomer();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showBookAppointment, setShowBookAppointment] = useState(false);

  const hasOpenOrders = openOrders(orders).length > 0;

  return (
    <>
      <div className="flex gap-3 px-6 py-4 bg-white border-b border-clinic-border">
        <button
          onClick={() => setShowNewOrder(true)}
          className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm font-medium hover:bg-clinic-blush transition-colors"
        >
          <PlusCircle size={16} />
          <span>הזמנה חדשה</span>
        </button>

        <button
          onClick={() => setShowRecordPayment(true)}
          disabled={!hasOpenOrders}
          title={hasOpenOrders ? undefined : 'אין הזמנות פתוחות לתשלום'}
          className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm font-medium hover:bg-clinic-blush transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DollarSign size={16} />
          <span>רשום תשלום</span>
        </button>

        <button
          onClick={() => setShowBookAppointment(true)}
          className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm font-medium hover:bg-clinic-blush transition-colors"
        >
          <Calendar size={16} />
          <span>קבע תור</span>
        </button>

        <button
          onClick={() => setShowAddNote(true)}
          className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm font-medium hover:bg-clinic-blush transition-colors"
        >
          <MessageSquare size={16} />
          <span>הוסף הערה</span>
        </button>
      </div>

      <NewOrderModal
        open={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        customerId={customerId}
        currentUser={currentUser}
      />

      <RecordPaymentModal
        open={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        currentUser={currentUser}
      />

      <AddNoteModal
        open={showAddNote}
        onClose={() => setShowAddNote(false)}
        customerId={customerId}
        currentUser={currentUser}
      />

      <BookAppointmentModal
        open={showBookAppointment}
        onClose={() => setShowBookAppointment(false)}
        customerId={customerId}
      />
    </>
  );
}
