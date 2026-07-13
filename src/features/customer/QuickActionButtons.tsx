import { PlusCircle, DollarSign, Calendar, MessageSquare } from 'lucide-react';

const actions = [
  { label: 'הזמנה חדשה', icon: <PlusCircle size={16} /> },
  { label: 'רשום תשלום', icon: <DollarSign size={16} /> },
  { label: 'קבע תור', icon: <Calendar size={16} /> },
  { label: 'הוסף הערה', icon: <MessageSquare size={16} /> },
];

export function QuickActionButtons() {
  return (
    <div className="flex gap-3 px-6 py-4 bg-white border-b border-clinic-border">
      {actions.map(action => (
        <button
          key={action.label}
          disabled
          title="זמין בקרוב"
          className="flex items-center gap-2 px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
