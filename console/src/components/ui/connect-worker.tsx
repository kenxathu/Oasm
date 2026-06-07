import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspaceState } from '@/hooks/useWorkspaceSelector';
import {
  useWorkspacesControllerGetWorkspaceApiKey,
  useWorkspacesControllerRotateApiKey,
} from '@/services/apis/gen/queries';
import { Copy, Minus, Plus, SquareTerminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from './confirm-dialog';
import { buildWorkerCommand } from './worker-command';
interface ConnectWorkerProps {
  networkId?: string;
}

const MIN_WORKER_COUNT = 1;
const MAX_WORKER_COUNT = 10;
const MIN_MAX_JOBS = 1;
const MAX_MAX_JOBS = 100;

/**
 * Keeps worker command numeric controls inside the supported task range.
 */
function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function ConnectWorker({ networkId }: ConnectWorkerProps) {
  const {
    state: { selectedWorkspaceId },
  } = useWorkspaceState();
  const { data, refetch } = useWorkspacesControllerGetWorkspaceApiKey({
    query: {
      queryKey: [selectedWorkspaceId],
      enabled: !!selectedWorkspaceId,
    },
  });
  const [open, setOpen] = useState(false);
  const [workerCount, setWorkerCount] = useState(1);
  const [maxJobs, setMaxJobs] = useState(10);

  const rawCommand = useMemo(
    () =>
      buildWorkerCommand({
        apiKey: data?.apiKey,
        maxJobs,
        networkId,
        replicas: workerCount,
      }),
    [data?.apiKey, maxJobs, networkId, workerCount],
  );

  const { mutate } = useWorkspacesControllerRotateApiKey({
    mutation: {
      onSuccess: () => {
        toast.success('API key rotated successfully');
        refetch();
      },
      onError: () => {
        toast.error('Failed to rotate API key');
      },
    },
  });

  // Temporary disable connect custom workspace worker in production mode
  if (import.meta.env.PROD) return null;

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText(rawCommand);
    toast.success('Command copied to clipboard');
  };

  const handleWorkerCountChange = (value: number) => {
    setWorkerCount(clampNumber(value, MIN_WORKER_COUNT, MAX_WORKER_COUNT));
  };

  const handleMaxJobsChange = (value: number) => {
    setMaxJobs(clampNumber(value, MIN_MAX_JOBS, MAX_MAX_JOBS));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <SquareTerminal className="shrink-0" />
          <span className="hidden lg:inline">Connect worker</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect worker</DialogTitle>
          <DialogDescription>
            Copy and paste the following code and API key into your worker:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="worker-count">Workers</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Remove worker"
                  disabled={workerCount <= MIN_WORKER_COUNT}
                  onClick={() => handleWorkerCountChange(workerCount - 1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="worker-count"
                  type="number"
                  min={MIN_WORKER_COUNT}
                  max={MAX_WORKER_COUNT}
                  value={workerCount}
                  onChange={(event) =>
                    handleWorkerCountChange(Number(event.target.value))
                  }
                  className="text-center"
                  aria-label="Worker count"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add worker"
                  disabled={workerCount >= MAX_WORKER_COUNT}
                  onClick={() => handleWorkerCountChange(workerCount + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-max-jobs">Jobs per worker</Label>
              <Input
                id="worker-max-jobs"
                type="number"
                min={MIN_MAX_JOBS}
                max={MAX_MAX_JOBS}
                value={maxJobs}
                onChange={(event) =>
                  handleMaxJobsChange(Number(event.target.value))
                }
              />
            </div>
          </div>
          {/* <p>API Key:</p>
                    <div className="relative bg-black text-white font-mono rounded-md p-4 text-sm">
                        <pre className="whitespace-pre-wrap">{apiKey}</pre>
                        <Button
                            onClick={handleCopyApiKey}
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 text-white hover:text-gray-300"
                        >
                            <Copy size={16} />
                        </Button>
                    </div> */}
          <div className="relative bg-black text-white font-mono rounded-md p-4 text-sm">
            <pre className="whitespace-pre-wrap">{rawCommand}</pre>
            <Button
              onClick={handleCopyCommand}
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 text-white hover:text-gray-300"
            >
              <Copy size={16} />
            </Button>
          </div>
        </div>
        <DialogFooter className="flex justify-between items-center gap-2">
          <ConfirmDialog
            title="Rotate API key"
            description="Are you sure you want to rotate the API key?"
            onConfirm={() => mutate({ id: selectedWorkspaceId })}
            trigger={
              <Button variant="outline" type="button">
                Rotate API key
              </Button>
            }
          />
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
