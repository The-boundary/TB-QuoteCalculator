/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetailPage } from './ProjectDetailPage';

const navigateMock = vi.fn();
const useProjectMock = vi.fn();
const archiveMutateMock = vi.fn();
const useArchiveQuoteMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 'project-1' }),
  };
});

vi.mock('@/hooks/useProjects', () => ({
  useProject: (...args: unknown[]) => useProjectMock(...args),
}));

vi.mock('@/hooks/useQuotes', () => ({
  useArchiveQuote: () => useArchiveQuoteMock(),
}));

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock('./LinkToKantataDialog', () => ({
  LinkToKantataDialog: () => null,
}));

vi.mock('./NewQuoteDialog', () => ({
  NewQuoteDialog: () => null,
}));

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    archiveMutateMock.mockReset();
    useArchiveQuoteMock.mockReturnValue({
      mutate: archiveMutateMock,
      isPending: false,
    });
    useProjectMock.mockReturnValue({
      data: {
        id: 'project-1',
        development_id: 'dev-1',
        development_name: 'Development A',
        development_client_name: 'Client A',
        kantata_id: null,
        name: 'Project A',
        is_forecasted: false,
        created_at: '2026-02-20T08:00:00.000Z',
        updated_at: '2026-02-20T08:00:00.000Z',
        quote_count: 1,
        latest_quote_status: 'draft',
        quotes: [
          {
            id: 'quote-1',
            mode: 'retainer',
            status: 'draft',
            rate_card_id: 'rate-card-1',
            created_at: '2026-02-20T08:00:00.000Z',
            updated_at: '2026-02-20T08:00:00.000Z',
            latest_version: {
              id: 'version-1',
              version_number: 3,
              duration_seconds: 60,
              total_hours: 120,
              shot_count: 30,
              pool_budget_hours: null,
              pool_budget_amount: null,
              hourly_rate: 125,
            },
            version_count: 3,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
  });

  it('archives quote after three delete clicks and does not navigate from icon click', () => {
    render(<ProjectDetailPage />);
    const deleteButton = screen.getByTitle('Delete quote');

    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);
    expect(archiveMutateMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    expect(archiveMutateMock).toHaveBeenCalledWith('quote-1', {
      onSuccess: expect.any(Function),
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('navigates to quote detail when the card body is clicked', () => {
    render(<ProjectDetailPage />);

    fireEvent.click(screen.getByText('v3'));

    expect(navigateMock).toHaveBeenCalledWith('/projects/project-1/quotes/quote-1');
  });
});
