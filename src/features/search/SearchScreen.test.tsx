import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchScreen } from './SearchScreen';
import { renderWithProviders } from '../../test/renderWithProviders';

function renderSearchScreen() {
  return renderWithProviders(<SearchScreen />);
}

describe('SearchScreen', () => {
  it('renders search input', () => {
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    expect(input).toBeInTheDocument();
  });

  it('renders all customers when query is empty', async () => {
    renderSearchScreen();
    await waitFor(
      () => expect(screen.getAllByRole('row').length).toBeGreaterThan(1),
      { timeout: 1000 }
    );
  });

  it('renders "no results" state when query does not match', async () => {
    const user = userEvent.setup();
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    await user.type(input, 'xxxxxxnonexistent');
    await waitFor(
      () => expect(screen.getByText(/לא נמצאו לקוחות/i)).toBeInTheDocument(),
      { timeout: 1000 }
    );
  });

  it('renders search results when query matches a customer', async () => {
    const user = userEvent.setup();
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    await user.type(input, 'רחל');
    await waitFor(
      () => expect(screen.getByText(/רחל אברהם/i)).toBeInTheDocument(),
      { timeout: 1000 }
    );
  });

  it('shows multiple results when query matches multiple customers', async () => {
    const user = userEvent.setup();
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    // '050' matches cust-1 and cust-5
    await user.type(input, '050');
    await waitFor(
      () => {
        // header row + at least one result row
        expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 1000 }
    );
  });

  it('renders "לקוחה חדשה" button in enabled state', () => {
    renderSearchScreen();
    const btn = screen.getByRole('button', { name: /לקוחה חדשה/i });
    expect(btn).not.toBeDisabled();
  });

  // Regression coverage for the bug where "Active Series"/"Outstanding Balance" columns always
  // read from unused mock data files (keyed by hardcoded ids that never matched real customer
  // GUIDs) instead of the real per-customer aggregates now returned by GET /api/v1/customers.
  it('renders the active series count and outstanding balance for a customer that has both', async () => {
    const user = userEvent.setup();
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    await user.type(input, 'רחל');
    await waitFor(() => expect(screen.getByText(/רחל אברהם/i)).toBeInTheDocument(), { timeout: 1000 });

    // MOCK_CUSTOMERS: cust-1 (רחל אברהם) has activeSeriesCount: 2, outstandingBalance: 450.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/₪450/)).toBeInTheDocument();
    expect(screen.queryByText('שולם')).not.toBeInTheDocument();
  });

  it('renders "—" and "שולם" for a customer with no active series and no outstanding balance', async () => {
    const user = userEvent.setup();
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    await user.type(input, 'דנה');
    await waitFor(() => expect(screen.getByText(/דנה שפירא/i)).toBeInTheDocument(), { timeout: 1000 });

    // MOCK_CUSTOMERS: cust-2 (דנה שפירא) has activeSeriesCount: 0, outstandingBalance: 0.
    // Scope to this customer's row (and to the "סדרות פעילות" column specifically, the 2nd
    // <td>) so this regression test would actually fail if only that column stopped rendering
    // "—" — the "תור הבא" column also renders its own unrelated "—" placeholder in this row.
    const row = screen.getByText(/דנה שפירא/i).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement).getAllByRole('cell');
    const activeSeriesCell = cells[1];
    expect(within(activeSeriesCell).getByText('—')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('שולם')).toBeInTheDocument();
  });

  // A customer with zero orders at all (never bought anything) must show a muted "—" in the
  // balance column, distinct from "שולם" (which is reserved for real orders that are fully paid).
  it('renders "—" (not "שולם") in the balance column for a customer with no orders at all', async () => {
    const user = userEvent.setup();
    renderSearchScreen();
    const input = screen.getByPlaceholderText(/חיפוש לקוחה לפי שם או טלפון/i);
    await user.type(input, 'אסתר');
    await waitFor(() => expect(screen.getByText(/אסתר מזרחי/i)).toBeInTheDocument(), { timeout: 1000 });

    // MOCK_CUSTOMERS: cust-3 (אסתר מזרחי) has outstandingBalance: null (no orders at all).
    const row = screen.getByText(/אסתר מזרחי/i).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement).getAllByRole('cell');
    const balanceCell = cells[2];
    expect(within(balanceCell).getByText('—')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('שולם')).not.toBeInTheDocument();
  });
});
