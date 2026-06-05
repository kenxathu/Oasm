import Page from '@/components/common/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import JobStatusBadge from '@/components/ui/job-status';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { JobStatus } from '@/services/apis/gen/queries';
import {
  getScanActivity,
  type ScanActivityLogDto,
  type ScanActivityWorkerDto,
} from '@/services/apis/scan-activity';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Activity,
  AlertTriangle,
  Clock,
  ListChecks,
  RefreshCw,
  Server,
  Terminal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';

dayjs.extend(relativeTime);

const statusAccent: Record<JobStatus, string> = {
  [JobStatus.pending]: 'border-yellow-500/50 bg-yellow-500/5',
  [JobStatus.in_progress]: 'border-purple-500/50 bg-purple-500/5',
  [JobStatus.completed]: 'border-green-500/50 bg-green-500/5',
  [JobStatus.failed]: 'border-red-500/50 bg-red-500/5',
  [JobStatus.cancelled]: 'border-muted bg-muted/40',
};

function WorkerRow({ worker }: { worker: ScanActivityWorkerDto }) {
  return (
    <div className="flex min-h-20 items-center justify-between gap-3 rounded-md border bg-background px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
          {worker.os ? (
            <img
              className="dark:brightness-0 dark:invert"
              width={24}
              height={24}
              src={`/${worker.os}.svg`}
              alt={worker.os}
            />
          ) : (
            <Server className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {worker.name || worker.id.slice(0, 8)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {worker.isOnline ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {worker.isOnline
                ? 'Online'
                : dayjs(worker.lastSeenAt).fromNow()}
            </span>
            <span>{worker.scope === 'cloud' ? 'Global' : 'Workspace'}</span>
            {worker.ipAddress ? <span>{worker.ipAddress}</span> : null}
          </div>
        </div>
      </div>
      <Badge
        variant={worker.currentJobsCount > 0 ? 'default' : 'outline'}
        className="shrink-0"
      >
        {worker.currentJobsCount} active
      </Badge>
    </div>
  );
}

function LogRow({ log }: { log: ScanActivityLogDto }) {
  return (
    <div
      className={cn(
        'rounded-md border bg-background p-4',
        statusAccent[log.status],
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={log.status} />
            <span className="min-w-0 truncate text-sm font-medium">
              {log.message}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {log.targetId && log.target ? (
              <Link
                className="font-medium text-foreground hover:underline"
                to={`/targets/${log.targetId}/asset-services`}
              >
                {log.target}
              </Link>
            ) : log.target ? (
              <span>{log.target}</span>
            ) : null}
            {log.asset ? <span>{log.asset}</span> : null}
            {log.tool ? <span>{log.tool}</span> : null}
            {log.workerName ? <span>{log.workerName}</span> : null}
            <span>{dayjs(log.updatedAt).fromNow()}</span>
          </div>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 capitalize">
          {log.jobRunType || 'manual'}
        </Badge>
      </div>

      {log.command ? (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{log.command}</span>
        </div>
      ) : null}

      {log.errorLogs.length > 0 ? (
        <div className="mt-3 space-y-2">
          {log.errorLogs.map((errorLog, index) => (
            <div
              key={`${log.id}-${index}`}
              className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{errorLog}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} className="h-20 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function ScanActivityPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['scan-activity'],
    queryFn: getScanActivity,
    refetchInterval: (query) => {
      const activity = query.state.data;
      return activity?.activeJobsCount || activity?.pendingJobsCount
        ? 2000
        : 5000;
    },
  });

  const workers = data?.workers ?? [];
  const logs = data?.logs ?? [];
  const activeWorkers = workers.filter((worker) => worker.currentJobsCount > 0);
  const failedLogs = logs.filter((log) => log.status === JobStatus.failed);

  return (
    <Page
      title="Scan Activity"
      header={
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                Active
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {data?.activeJobsCount ?? 0}
              </div>
            </div>
            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Pending
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {data?.pendingJobsCount ?? 0}
              </div>
            </div>
            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Server className="h-4 w-4" />
                Workers
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {activeWorkers.length}/{workers.length}
              </div>
            </div>
            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Failed
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {failedLogs.length}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Server className="h-4 w-4" />
                Workers
              </div>
              <Badge variant="outline">{workers.length}</Badge>
            </div>
            {isLoading ? (
              <LoadingRows />
            ) : workers.length > 0 ? (
              <div className="space-y-3">
                {workers.map((worker) => (
                  <WorkerRow key={worker.id} worker={worker} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                No workers connected.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4" />
              Scan logs
            </div>
            <Badge variant="outline">{logs.length}</Badge>
          </div>
          {isLoading ? (
            <LoadingRows />
          ) : logs.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-14rem)] min-h-[420px]">
              <div className="space-y-3 pr-3">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
              No scan logs yet.
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
