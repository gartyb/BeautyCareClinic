import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { useCustomer } from '../../contexts/CustomerContext';
import { activeSeries } from './selectors';
import { CustomerCardHeader } from './CustomerCardHeader';
import { SummaryRow } from './SummaryRow';
import { QuickActionButtons } from './QuickActionButtons';
import { ActiveSeriesTab } from './tabs/ActiveSeriesTab';
import { TreatmentHistoryTab } from './tabs/TreatmentHistoryTab';
import { OrdersTab } from './tabs/OrdersTab';
import { NotesTab } from './tabs/NotesTab';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { TimerPanel } from './TimerPanel';
import type { User } from '../../types/User';

interface CustomerCardProps {
  currentUser: User;
}

const tabItems = [
  { value: 'series', label: 'חבילות פעילות' },
  { value: 'history', label: 'היסטוריית טיפולים' },
  { value: 'orders', label: 'הזמנות ותשלומים' },
  { value: 'appointments', label: 'תורים' },
  { value: 'notes', label: 'הערות' },
];

export function CustomerCard({ currentUser }: CustomerCardProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveCustomer, activeCustomer, treatmentSeries } = useCustomer();
  const [isLoading, setIsLoading] = useState(true);

  // CR-007: smart default tab — show active series tab if there are active series, else history
  const defaultTab = activeSeries(treatmentSeries).length > 0 ? 'series' : 'history';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (id) {
      setActiveCustomer(id);
    }
    setIsLoading(false);
  }, [id, setActiveCustomer]);

  // Update active tab when customer changes and default tab may differ
  useEffect(() => {
    setActiveTab(activeSeries(treatmentSeries).length > 0 ? 'series' : 'history');
  }, [activeCustomer, treatmentSeries]);

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
      <QuickActionButtons currentUser={currentUser} customerId={id ?? ''} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs.Root defaultValue={defaultTab} value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
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
              <ActiveSeriesTab currentUser={currentUser} />
            </Tabs.Content>
            <Tabs.Content value="history">
              <TreatmentHistoryTab />
            </Tabs.Content>
            <Tabs.Content value="orders">
              <OrdersTab currentUser={currentUser} />
            </Tabs.Content>

            <Tabs.Content value="appointments">
              <AppointmentsTab />
            </Tabs.Content>

            <Tabs.Content value="notes">
              <NotesTab />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>

      {activeTab === 'series' && <TimerPanel currentUser={currentUser} />}
    </div>
  );
}
