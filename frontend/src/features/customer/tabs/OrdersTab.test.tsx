import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrdersTab } from './OrdersTab';
import type { CustomerOrder } from '../../../types/Order';
import type { User } from '../../../types/User';

// Real API responses use `items` + `orderDate` (no `orderItems` / `createdDate`).
// Mock the hooks directly so the test exercises OrdersTab against that exact shape.
const mockUseCustomer = vi.fn();
const mockUsePackageTypes = vi.fn();

vi.mock('../../../contexts/CustomerContext', () => ({
  useCustomer: () => mockUseCustomer(),
}));

vi.mock('../../../contexts/PackageTypesContext', () => ({
  usePackageTypes: () => mockUsePackageTypes(),
}));

const currentUser: User = {
  id: 'user-1',
  fullName: 'מנהלת מבחן',
  email: 'test@clinic.local',
  role: 'Manager',
};

const apiShapedOrder: CustomerOrder = {
  id: 'order-1',
  customerId: 'cust-1',
  orderDate: '2026-07-19',
  discountedPrice: 300,
  amountPaid: 0,
  remainingBalance: 120,
  maxPaymentCount: 3,
  paymentCount: 0,
  items: [
    {
      id: 'item-1',
      packageTypeId: 'pt-1',
      packageTypeName: 'חבילת טיפול בודד',
      unitPrice: 300,
      seriesId: 'series-1',
      packageNumber: 4,
    },
  ],
};

function renderOrdersTab() {
  return render(<OrdersTab currentUser={currentUser} />);
}

describe('OrdersTab', () => {
  it('renders the package name and formatted order date for a real API-shaped order (items + orderDate, no orderItems/createdDate)', () => {
    mockUseCustomer.mockReturnValue({ orders: [apiShapedOrder], payments: [] });
    mockUsePackageTypes.mockReturnValue({ packageTypes: [] });

    renderOrdersTab();

    // Package name from item.packageTypeName should be shown (not blank list).
    expect(screen.getByText('חבילת טיפול בודד')).toBeInTheDocument();

    // orderDate '2026-07-19' should be formatted as dd/MM/yyyy, not "NaN/NaN/NaN".
    expect(screen.getByText('19/07/2026')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('renders the "סה"כ" total from order.discountedPrice for a real API-shaped order (no totalPrice field)', () => {
    mockUseCustomer.mockReturnValue({ orders: [apiShapedOrder], payments: [] });
    mockUsePackageTypes.mockReturnValue({ packageTypes: [] });

    renderOrdersTab();

    // discountedPrice (300) should be used as the total, not the missing totalPrice field falling back to 0.
    expect(screen.getByText('₪300')).toBeInTheDocument();
    // Only "שולם" (amountPaid: 0) should render ₪0 — the total must not also fall back to ₪0.
    expect(screen.getAllByText('₪0')).toHaveLength(1);
  });
});
