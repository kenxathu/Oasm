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
import { createManualNetworkInterfacePayload } from './manual-network-input';

const formSchema = z.object({
  interfaceName: z.string(),
  networkCidr: z.string().min(1, 'Network CIDR is required'),
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interfaceName: '',
      networkCidr: '',
    },
  });

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
    try {
      mutate(createManualNetworkInterfacePayload(values));
    } catch (error) {
      form.setError('networkCidr', {
        message: error instanceof Error ? error.message : 'Invalid network CIDR',
      });
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus data-icon="inline-start" /> Manual input
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add manual network</DialogTitle>
            <DialogDescription>
              Add an internal CIDR that was provided by an end user.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="interfaceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Office LAN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="networkCidr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network CIDR</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.0/24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Creating...' : 'Add network'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
