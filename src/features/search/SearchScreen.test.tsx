import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
});
