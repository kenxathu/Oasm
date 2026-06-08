import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ConnectWorker } from '@/components/ui/connect-worker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useInternalNetworksControllerCreateTargetsFromInterfaces,
  useInternalNetworksControllerGetManyNetworkInterfaces,
  type GetManyNetworkInterfacesResponseDtoDataItem,
} from '@/services/apis/gen/queries';
import {
  deleteNetworkInterface,
  type DefaultMessageResponseDto,
} from '@/services/apis/internal-networks';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { format } from 'date-fns';
import { TargetIcon, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AddNetworkInterfaceDialog } from './add-network-interface-dialog';

interface NetworkInterfaceItem extends GetManyNetworkInterfacesResponseDtoDataItem {
  id: string;
  targetId?: string;
  interfaceName: string;
  ipAddress: string;
  cidr: string;
  gatewayIp: string;
  gatewayMac: string;
  createdAt: string;
}

interface NetworkInterfacesTableProps {
  networkId: string;
}

export function NetworkInterfacesTable({
  networkId,
}: NetworkInterfacesTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useInternalNetworksControllerGetManyNetworkInterfaces(
    networkId,
    {
      limit: 50,
      page: 1,
    },
    {
      query: {
        refetchInterval: 5000,
      },
    },
  );

  const { mutate: createTargets, isPending } =
    useInternalNetworksControllerCreateTargetsFromInterfaces({
      mutation: {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['internal-networks'],
          });
        },
        onError: (error: AxiosError<{ message: string }>) => {
          toast.error(error.response?.data.message);
        },
      },
    });

  const deleteMutation = useMutation<
    DefaultMessageResponseDto,
    AxiosError<{ message: string }>,
    string
  >({
    mutationFn: (id: string) =>
      deleteNetworkInterface(
        networkId,
        id,
      ) as unknown as Promise<DefaultMessageResponseDto>,
    onSuccess: () => {
      toast.success('Network interface deleted');
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] ===
          `/api/internal-networks/${networkId}/network-interfaces`,
      });
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data.message ?? 'Failed to delete interface');
    },
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (data?.data) {
      const initialSelected = data.data
        .filter((iface) => (iface as NetworkInterfaceItem).targetId)
        .map((iface) => (iface as NetworkInterfaceItem).id);
      setSelectedIds(initialSelected);
    }
  }, [data]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleStartDiscovery = () => {
    const idsToCreate = selectedIds.filter((id) => {
      const iface = data?.data.find(
        (i) => (i as NetworkInterfaceItem).id === id,
      );
      return iface && !(iface as NetworkInterfaceItem).targetId;
    });

    if (idsToCreate.length === 0) return;

    createTargets({
      data: {
        networkInterfaceIds: idsToCreate,
      },
    });
  };

  const hasSelectableItems = selectedIds.some((id) => {
    const iface = data?.data.find((i) => (i as NetworkInterfaceItem).id === id);
    return iface && !(iface as NetworkInterfaceItem).targetId;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Network Interfaces</CardTitle>
        <div className="flex items-center gap-2">
          <ConnectWorker
            networkId={networkId}
            triggerLabel="Auto detect"
            triggerSize="sm"
          />
          <AddNetworkInterfaceDialog
            networkId={networkId}
            onSuccess={() =>
              queryClient.invalidateQueries({
                predicate: (query) =>
                  query.queryKey[0] ===
                  `/api/internal-networks/${networkId}/network-interfaces`,
              })
            }
          />
          <Button
            onClick={handleStartDiscovery}
            disabled={isPending || !hasSelectableItems}
            variant="outline"
            size="sm"
          >
            <TargetIcon data-icon="inline-start" />
            {isPending ? 'Starting...' : 'Start discovery'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Interface Name</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>CIDR</TableHead>
              <TableHead>Gateway IP</TableHead>
              <TableHead>Gateway MAC</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((iface) => {
              const item = iface as NetworkInterfaceItem;
              const isDisabled = !!item.targetId;
              return (
                <TableRow
                  key={item.id}
                  className={
                    item.targetId ? 'cursor-pointer hover:bg-muted/50' : ''
                  }
                  onClick={() =>
                    item.targetId && navigate(`/targets/${item.targetId}`)
                  }
                >
                  <TableCell>
                    <Checkbox
                      disabled={isDisabled}
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                    />
                  </TableCell>
                  <TableCell>{item.interfaceName}</TableCell>
                  <TableCell>{item.ipAddress}</TableCell>
                  <TableCell>{item.cidr}</TableCell>
                  <TableCell>{item.gatewayIp || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.gatewayMac || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(item.createdAt), 'PP')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMutation.mutate(item.id);
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 data-icon="button" />
                      <span className="sr-only">Delete interface</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
