/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesPage } from './TemplatesPage';

const useAuthMock = vi.fn();
const useTemplatesMock = vi.fn();
const useDeleteTemplateMock = vi.fn();
const useCreateTemplateMock = vi.fn();
const useUpdateTemplateMock = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: () => useTemplatesMock(),
  useDeleteTemplate: () => useDeleteTemplateMock(),
  useCreateTemplate: () => useCreateTemplateMock(),
  useUpdateTemplate: () => useUpdateTemplateMock(),
}));

describe('TemplatesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useTemplatesMock.mockReset();
    useDeleteTemplateMock.mockReset();
    useCreateTemplateMock.mockReset();
    useUpdateTemplateMock.mockReset();

    useAuthMock.mockReturnValue({ access: { is_admin: true } });
    useDeleteTemplateMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    useCreateTemplateMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useUpdateTemplateMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('renders templates even when shots payload is missing', () => {
    useTemplatesMock.mockReturnValue({
      data: [
        {
          id: 'template-1',
          name: '60s Masterplan',
          duration_seconds: 60,
          description: null,
          rate_card_id: null,
          created_by: null,
          created_at: '2026-02-20T08:00:00.000Z',
          updated_at: '2026-02-20T08:00:00.000Z',
          shots: undefined,
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<TemplatesPage />);

    expect(screen.getByText('Film Templates')).toBeInTheDocument();
    expect(screen.getByText('60s Masterplan')).toBeInTheDocument();

    fireEvent.click(screen.getByText('60s Masterplan'));
    expect(screen.getByText(/For a 60s film/)).toBeInTheDocument();
  });
});
