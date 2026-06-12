import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, it, vi } from 'vitest';
import { NetworkInterfacesTable } from './network-interfaces-table';

const mocks = vi.hoisted(() => ({
  createTargetsFromInterfaces: vi.fn(),
  getManyNetworkInterfaces: vi.fn(),
  getNetworkInterfacesQueryKey: vi.fn(),
}));

vi.mock('@/components/ui/connect-worker', () => ({
  ConnectWorker: () => <button type="button">Auto detect</button>,
}));

vi.mock('./add-network-interface-dialog', () => ({
  AddNetworkInterfaceDialog: ({
    onSuccess,
  }: {
    onSuccess?: () => void;
  }) => (
    <button type="button" onClick={() => onSuccess?.()}>
      Manual input
    </button>
  ),
}));

vi.mock('@/services/apis/internal-networks', () => ({
  deleteNetworkInterface: vi.fn(),
}));

vi.mock('@/services/apis/gen/queries', () => ({
  getInternalNetworksControllerGetManyNetworkInterfacesQueryKey: (
    ...args: unknown[]
  ) => mocks.getNetworkInterfacesQueryKey(...args),
  useInternalNetworksControllerCreateTargetsFromInterfaces: (
    ...args: unknown[]
  ) => mocks.createTargetsFromInterfaces(...args),
  useInternalNetworksControllerGetManyNetworkInterfaces: (...args: unknown[]) =>
    mocks.getManyNetworkInterfaces(...args),
}));

describe('NetworkInterfacesTable', () => {
  it('refreshes the active network interfaces query after adding a manual interface', async () => {
    const networkId = 'network-1';
    const queryParams = {
      limit: 50,
      page: 1,
    };
    const queryKey = ['network-interfaces', networkId, queryParams];

    mocks.getNetworkInterfacesQueryKey.mockReturnValue(queryKey);
    mocks.getManyNetworkInterfaces.mockReturnValue({
      data: {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
      },
    });
    mocks.createTargetsFromInterfaces.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    const { queryClient, user } = renderWithProviders(
      <NetworkInterfacesTable networkId={networkId} />,
    );
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: /manual input/i }));

    expect(mocks.getManyNetworkInterfaces).toHaveBeenCalledWith(
      networkId,
      queryParams,
      expect.objectContaining({
        query: expect.objectContaining({
          refetchInterval: 5000,
        }),
      }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey,
      exact: true,
    });
  });
});
