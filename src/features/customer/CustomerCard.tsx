import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { useCustomer } from '../../contexts/CustomerContext';
import { CustomerCardHeader } from './CustomerCardHeader';
import { SummaryRow } from './SummaryRow';
import { QuickActionButtons } from './QuickActionButtons';
import { ActiveSeriesTab } from './tabs/ActiveSeriesTab';
import { TreatmentHistoryTab } from './tabs/TreatmentHistoryTab';
import { OrdersTab } from './tabs/OrdersTab';
import { NotesTab } from './tabs/NotesTab';
import { TimerPanel } from './TimerPanel';

const tabItems = [
  { value: 'series', label: 'סדרות פעילות' },
  { value: 'history', label: 'היסטוריית טיפולים' },
  { value: 'orders', label: 'הזמנות ותשלומים' },
  { value: 'notes', label: 'הערות' },
];

export function CustomerCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveCustomer, activeCustomer } = useCustomer();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('series');

  useEffect(() => {
    if (id) {
      setActiveCustomer(id);
    }
    setIsLoading(false);
  }, [id, setActiveCustomer]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-clinic-bg flex items-center justify-center">
        <p className="text-clinic-muted">טוען...</p>
      </div>
    );
  }

  if (!activeCustomer && id) {
    return (
      <div className="flex-1 bg-clinic-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-clinic-muted mb-4">לקוחה לא נמצאה</p>
          <button
            onClick={() => navigate('/search')}
            className="px-4 py-2 border border-clinic-gold text-clinic-gold rounded-lg text-sm"
          >
            חזרה לחיפוש
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-clinic-bg flex flex-col overflow-hidden">
      <CustomerCardHeader />
      <SummaryRow />
      <QuickActionButtons />

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs.Root defaultValue="series" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <Tabs.List dir="rtl" className="flex border-b border-clinic-border bg-white px-6 gap-1">
            {tabItems.map(tab => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-4 py-3 text-sm font-medium text-clinic-muted border-b-2 border-transparent data-[state=active]:border-clinic-gold data-[state=active]:text-clinic-gold transition-colors"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <div className="flex-1 overflow-y-auto">
            <Tabs.Content value="series">
              <ActiveSeriesTab />
            </Tabs.Content>
            <Tabs.Content value="history">
              <TreatmentHistoryTab />
            </Tabs.Content>
            <Tabs.Content value="orders">
              <OrdersTab />
            </Tabs.Content>

            <Tabs.Content value="notes">
              <NotesTab />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>

      {activeTab === 'series' && <TimerPanel />}
    </div>
  );
}
