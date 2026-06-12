import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import JobsRegistryPage from './jobs-registry';

const mocks = vi.hoisted(() => ({
  getManyJobHistories: vi.fn(),
}));

vi.mock('@/components/ui/data-table', () => ({
  DataTable: () => <div data-testid="jobs-registry-table" />,
}));

vi.mock('@/services/apis/gen/queries', () => ({
  JobStatus: {
    pending: 'pending',
    in_progress: 'in_progress',
    cancelled: 'cancelled',
    failed: 'failed',
    completed: 'completed',
  },
  useJobsRegistryControllerGetManyJobHistories: (...args: unknown[]) =>
    mocks.getManyJobHistories(...args),
}));

vi.mock('@/services/apis/jobs-registry', () => ({
  startJobHistoryScan: vi.fn(),
  stopJobHistoryScan: vi.fn(),
}));

describe('JobsRegistryPage', () => {
  it('polls job histories so start and stop buttons stay synced with worker status', () => {
    mocks.getManyJobHistories.mockReturnValue({
      data: {
        data: [],
        page: 1,
        limit: 10,
        total: 0,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithProviders(<JobsRegistryPage />);

    expect(screen.getByTestId('jobs-registry-table')).toBeTruthy();
    expect(mocks.getManyJobHistories).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        query: expect.objectContaining({
          refetchInterval: 5000,
        }),
      }),
    );
  });
});
