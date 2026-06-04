import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkersControllerGetWorkers } from '@/services/apis/gen/queries';
import {
  createNetworkInterface,
  type CreateNetworkInterfaceDto,
} from '@/services/apis/internal-networks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useWorkspaceState } from '@/hooks/useWorkspaceSelector';

const formSchema = z.object({
  interfaceName: z.string().min(1, 'Interface name is required'),
  ipAddress: z.string().min(1, 'IP address is required'),
  cidr: z.string().min(1, 'CIDR is required'),
  gatewayIp: z.string().min(1, 'Gateway IP is required'),
  gatewayMac: z.string().min(1, 'Gateway MAC is required'),
  workerId: z.string().uuid('Worker selection is required'),
});

type FormValues = z.infer<typeof formSchema>;

interface AddNetworkInterfaceDialogProps {
  networkId: string;
  onSuccess?: () => void;
}

export function AddNetworkInterfaceDialog({
  networkId,
  onSuccess,
}: AddNetworkInterfaceDialogProps) {
  const [open, setOpen] = useState(false);
  const { state } = useWorkspaceState();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interfaceName: '',
      ipAddress: '',
      cidr: '',
      gatewayIp: '',
      gatewayMac: '',
      workerId: '',
    },
  });

  const { data: workersData, isLoading: workersLoading } =
    useWorkersControllerGetWorkers(
      {
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        workspaceId: state.selectedWorkspaceId,
      },
      {
        query: {
          enabled: !!state.selectedWorkspaceId,
        },
      },
    );

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateNetworkInterfaceDto) =>
      createNetworkInterface(networkId, data),
    onSuccess: () => {
      setOpen(false);
      toast.success('Network interface created successfully');
      onSuccess?.();
      form.reset();
    },
    onError: (error: unknown) => {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? 'Failed to create network interface',
      );
    },
  });

  const onSubmit = (values: FormValues) => {
    mutate(values);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" /> Add interface
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add network interface</DialogTitle>
            <DialogDescription>
              Define an IP interface and connect it to this internal network.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="interfaceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interface name</FormLabel>
                    <FormControl>
                      <Input placeholder="eth0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ipAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP address</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cidr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CIDR</FormLabel>
                    <FormControl>
                      <Input placeholder="24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gatewayIp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway IP</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gatewayMac"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway MAC</FormLabel>
                    <FormControl>
                      <Input placeholder="aa:bb:cc:dd:ee:ff" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="workerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Worker</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            workersLoading ? 'Loading workers...' : 'Select worker'
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {workersData?.data?.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.name || worker.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isPending || workersLoading}>
                  {isPending ? 'Creating...' : 'Create interface'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
