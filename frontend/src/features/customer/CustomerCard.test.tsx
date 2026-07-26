import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerCard } from './CustomerCard';
import type { Customer } from '../../types/Customer';
import type { TreatmentSeries } from '../../types/TreatmentSeries';
import type { User } from '../../types/User';

// This test targets the bug where any data refresh (payment, note, order, treatment, etc.)
// re-triggers the CR-007 "smart default tab" logic and silently snaps the user back to
// Active Series / Treatment History, discarding a tab the user manually selected.
//
// Child components are stubbed out so the test isolates CustomerCard's own tab-selection
// logic rather than re-testing each tab's internals (those have their own test files).

const mockUseCustomer = vi.fn();
let mockParamsId = 'cust-1';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: mockParamsId }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../contexts/CustomerContext', () => ({
  useCustomer: () => mockUseCustomer(),
}));

vi.mock('./CustomerCardHeader', () => ({
  CustomerCardHeader: () => <div data-testid="header-stub" />,
}));

vi.mock('./SummaryRow', () => ({
  SummaryRow: () => <div data-testid="summary-stub" />,
}));

vi.mock('./QuickActionButtons', () => ({
  QuickActionButtons: () => <div data-testid="quick-actions-stub" />,
}));

vi.mock('./TimerPanel', () => ({
  TimerPanel: () => <div data-testid="timer-panel-stub" />,
}));

vi.mock('./tabs/ActiveSeriesTab', () => ({
  ActiveSeriesTab: () => <div data-testid="active-series-tab">ActiveSeriesTab content</div>,
}));

vi.mock('./tabs/TreatmentHistoryTab', () => ({
  TreatmentHistoryTab: () => <div data-testid="treatment-history-tab">TreatmentHistoryTab content</div>,
}));

vi.mock('./tabs/OrdersTab', () => ({
  OrdersTab: () => <div data-testid="orders-tab">OrdersTab content</div>,
}));

vi.mock('./tabs/AppointmentsTab', () => ({
  AppointmentsTab: () => <div data-testid="appointments-tab">AppointmentsTab content</div>,
}));

vi.mock('./tabs/NotesTab', () => ({
  NotesTab: () => <div data-testid="notes-tab">NotesTab content</div>,
}));

const currentUser: User = {
  id: 'user-1',
  fullName: 'מנהלת מבחן',
  email: 'test@clinic.local',
  role: 'Manager',
};

function customer(id: string): Customer {
  return {
    id,
    fullName: `לקוחה ${id}`,
    phone: '0500000000',
    email: 'c@example.com',
    activeSeriesCount: 0,
    outstandingBalance: 0,
    createdDate: '2026-01-01',
  };
}

function activeSeriesFixture(customerId: string): TreatmentSeries {
  return {
    id: `series-${customerId}`,
    orderItemId: `item-${customerId}`,
    seriesKind: 'quantity',
    customerId,
    totalTreatments: 10,
    completedTreatments: 2,
  };
}

function baseCustomerContext(overrides: Partial<ReturnType<typeof mockUseCustomer>> = {}) {
  return {
    setActiveCustomer: vi.fn(),
    activeCustomer: customer('cust-1'),
    treatmentSeries: [activeSeriesFixture('cust-1')],
    ...overrides,
  };
}

beforeEach(() => {
  mockUseCustomer.mockReset();
  mockParamsId = 'cust-1';
});

describe('CustomerCard — smart default tab vs. manual tab selection', () => {
  it('does not snap back to Active Series after a same-customer data refresh once the user manually picked a different tab', () => {
    mockUseCustomer.mockReturnValue(baseCustomerContext());

    const { rerender } = render(<CustomerCard currentUser={currentUser} />);

    // Default lands on 'series' since the customer has an active series.
    expect(screen.getByTestId('active-series-tab')).toBeInTheDocument();

    // User manually switches to the Notes tab.
    // Radix Tabs activates a trigger on `mousedown` (not `click`), see TabsTrigger implementation.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'הערות' }), { button: 0 });
    expect(screen.getByTestId('notes-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('active-series-tab')).not.toBeInTheDocument();

    // Simulate a data refresh for the SAME customer (e.g. after recording a payment/note/order):
    // CustomerContext's refreshForCustomer replaces `allSeries` with a new array reference for
    // the same customer id. Mock a new `treatmentSeries` array reference + a new `activeCustomer`
    // object reference (same id) and re-render.
    mockUseCustomer.mockReturnValue(
      baseCustomerContext({
        activeCustomer: customer('cust-1'), // new object reference, same id
        treatmentSeries: [activeSeriesFixture('cust-1')], // new array reference, same customer
      })
    );
    rerender(<CustomerCard currentUser={currentUser} />);

    // The manually-selected Notes tab must still be showing — this is the bug being fixed.
    expect(screen.getByTestId('notes-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('active-series-tab')).not.toBeInTheDocument();
  });

  it('still applies the smart default tab when navigating to a genuinely different customer, even after a manual pick on the previous customer', () => {
    mockUseCustomer.mockReturnValue(baseCustomerContext());

    const { rerender } = render(<CustomerCard currentUser={currentUser} />);
    expect(screen.getByTestId('active-series-tab')).toBeInTheDocument();

    // Manually pick "תורים" (appointments) for customer cust-1.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'תורים' }), { button: 0 });
    expect(screen.getByTestId('appointments-tab')).toBeInTheDocument();

    // Navigate to a genuinely different customer (different id) with NO active series —
    // smart default should land on 'history', overriding the manual pick from the previous customer.
    mockParamsId = 'cust-2';
    mockUseCustomer.mockReturnValue(
      baseCustomerContext({
        activeCustomer: customer('cust-2'),
        treatmentSeries: [], // no active series for this customer
      })
    );
    rerender(<CustomerCard currentUser={currentUser} />);

    expect(screen.getByTestId('treatment-history-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('appointments-tab')).not.toBeInTheDocument();
  });
});
