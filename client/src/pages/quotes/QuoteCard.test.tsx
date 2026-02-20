/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuoteListItem } from '@/hooks/useQuotes';
import { QuoteCard } from './QuoteCard';

const navigateMock = vi.fn();
const mutateMock = vi.fn();
const useArchiveQuoteMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/useQuotes', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useQuotes')>('@/hooks/useQuotes');
  return {
    ...actual,
    useArchiveQuote: () => useArchiveQuoteMock(),
  };
});

const quote: QuoteListItem = {
  id: 'quote-1',
  project_id: 'project-1',
  mode: 'retainer',
  status: 'draft',
  rate_card_id: 'rate-card-1',
  created_by: 'user-1',
  created_at: '2026-02-20T08:00:00.000Z',
  updated_at: '2026-02-20T08:00:00.000Z',
  project_name: 'Project Phoenix',
  kantata_id: 'K-101',
  is_forecasted: false,
  development_id: 'development-1',
  development_name: 'Phoenix Dev',
  development_client_name: 'Client A',
  latest_version: {
    id: 'version-1',
    version_number: 3,
    duration_seconds: 60,
    shot_count: 30,
    pool_budget_hours: null,
    pool_budget_amount: null,
    total_hours: 180,
    hourly_rate: 125,
  },
  version_count: 3,
};

describe('QuoteCard', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mutateMock.mockReset();
    useArchiveQuoteMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    });
  });

  it('shows delete icon without hover state', () => {
    render(<QuoteCard quote={quote} />);

    expect(screen.getByTitle('Delete quote')).toBeInTheDocument();
  });

  it('navigates when card is clicked', () => {
    render(<QuoteCard quote={quote} />);

    fireEvent.click(screen.getByText('Project Phoenix'));

    expect(navigateMock).toHaveBeenCalledWith('/projects/project-1/quotes/quote-1');
  });

  it('requires three delete clicks before archiving', () => {
    render(<QuoteCard quote={quote} />);
    const deleteButton = screen.getByTitle('Delete quote');

    fireEvent.click(deleteButton);
    expect(screen.getByText('Click delete 2 more times to confirm')).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    expect(screen.getByText('Click once more to permanently delete')).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    expect(mutateMock).toHaveBeenCalledWith('quote-1');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
