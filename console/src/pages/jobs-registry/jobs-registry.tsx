import Page from '@/components/common/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import JobStatusBadge from '@/components/ui/job-status';
import { useServerDataTable } from '@/hooks/useServerDataTable';
import { useWorkspaceState } from '@/hooks/useWorkspaceSelector';
import {
  startJobHistoryScan,
  stopJobHistoryScan,
} from '@/services/apis/jobs-registry';
import {
  type JobHistoryResponseDto,
  JobStatus,
  useJobsRegistryControllerGetManyJobHistories,
  useTargetsControllerDeleteTargetFromWorkspace,
} from '@/services/apis/gen/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { Calendar, Loader2Icon, Play, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
dayjs.extend(duration);

const JobsRegistryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    state: { selectedWorkspaceId },
  } = useWorkspaceState();
  const [mutatingHistoryId, setMutatingHistoryId] = useState<string | null>(
    null,
  );
  const {
    tableParams: { page, pageSize, sortBy, sortOrder },
    tableHandlers: { setPage, setPageSize, setParams },
  } = useServerDataTable();

  const {
    data: jobsData,
    isLoading,
    isError,
    error,
  } = useJobsRegistryControllerGetManyJobHistories(
    {
      page,
      limit: pageSize,
      sortBy,
      sortOrder,
    },
    {
      query: {
        enabled: true,
      },
    },
  );

  const refreshJobHistories = () =>
    queryClient.invalidateQueries({
      queryKey: ['/api/jobs-registry/histories'],
    });

  const startScanMutation = useMutation({
    mutationFn: startJobHistoryScan,
    onMutate: (id) => setMutatingHistoryId(id),
    onSuccess: () => {
      toast.success('Scan started successfully');
      void refreshJobHistories();
    },
    onError: () => toast.error('Failed to start scan'),
    onSettled: () => setMutatingHistoryId(null),
  });

  const stopScanMutation = useMutation({
    mutationFn: stopJobHistoryScan,
    onMutate: (id) => setMutatingHistoryId(id),
    onSuccess: () => {
      toast.success('Scan stopped successfully');
      void refreshJobHistories();
    },
    onError: () => toast.error('Failed to stop scan'),
    onSettled: () => setMutatingHistoryId(null),
  });

  const deleteTargetMutation = useTargetsControllerDeleteTargetFromWorkspace({
    mutation: {
      onSuccess: () => {
        toast.success('Discovery domain deleted successfully');
        void refreshJobHistories();
        void queryClient.invalidateQueries({ queryKey: ['targets'] });
      },
      onError: () => toast.error('Failed to delete discovery domain'),
      onSettled: () => setMutatingHistoryId(null),
    },
  });

  const columns: ColumnDef<JobHistoryResponseDto>[] = [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <JobStatusBadge
              onlyIcon
              status={row.original.status as JobStatus}
            />
            <pre>
              {row.original?.jobHistoryName ||
                row.original?.workflowName ||
                'Manual run'}
            </pre>
          </div>
        );
      },
    },
    {
      accessorKey: 'totalJobs',
      header: 'Total jobs',
      cell: ({ row }) => {
        return (
          <div>
            <b>{row.original.totalJobs}</b> jobs
          </div>
        );
      },
    },
    {
      accessorKey: 'targetValue',
      header: 'Discovery domain',
      cell: ({ row }) => {
        const targetLabel = row.original.targetValue || 'Unknown target';

        return (
          <div className="flex flex-col">
            <span className="font-medium">{targetLabel}</span>
            {row.original.targetCount && row.original.targetCount > 1 && (
              <span className="text-xs text-muted-foreground">
                {row.original.targetCount} targets
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: ({ row }) => {
        const job = row.original;
        const createdAt = new Date(job.updatedAt);
        return (
          <div className="flex flex-col text-muted-foreground text-xs gap-3">
            <span className="flex items-center gap-1">
              <Calendar size={20} />
              {createdAt.toLocaleString()}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: '',
      header: 'Created At',
      cell: ({ row }) => {
        return (
          <Badge variant="outline">
            <span className="text-xs font-medium capitalize">
              {row.original?.jobRunType || 'manual'}
            </span>
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const history = row.original;
        const canStop =
          history.status === JobStatus.pending ||
          history.status === JobStatus.in_progress;
        const canStart =
          history.status === JobStatus.cancelled ||
          history.status === JobStatus.failed;
        const canDeleteDiscoveryDomain =
          history.status !== JobStatus.pending &&
          history.status !== JobStatus.in_progress &&
          history.targetType === 'DOMAIN' &&
          history.targetCount === 1 &&
          !!history.targetId &&
          !!selectedWorkspaceId;
        const isPending =
          mutatingHistoryId === history.id &&
          (startScanMutation.isPending ||
            stopScanMutation.isPending ||
            deleteTargetMutation.isPending);

        if (!canStop && !canStart && !canDeleteDiscoveryDomain) {
          return (
            <div className="flex justify-end text-xs text-muted-foreground">
              No action
            </div>
          );
        }

        return (
          <div className="flex justify-end gap-2">
            {canStop && (
              <ConfirmDialog
                title="Stop scan"
                description="This cancels pending jobs and prevents workers from picking up more work from this scan."
                confirmText="Stop scan"
                onConfirm={() => stopScanMutation.mutate(history.id)}
                trigger={
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <Square />
                    )}
                    Stop
                  </Button>
                }
              />
            )}
            {canStart && (
              <ConfirmDialog
                title="Start scan"
                description="This moves stopped or failed jobs back to pending so workers can pick them up again."
                confirmText="Start scan"
                onConfirm={() => startScanMutation.mutate(history.id)}
                trigger={
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <Play />
                    )}
                    Start
                  </Button>
                }
              />
            )}
            {canDeleteDiscoveryDomain && (
              <ConfirmDialog
                title="Delete discovery domain"
                description={`This will permanently delete "${history.targetValue}" and all related discovered data.`}
                confirmText="Delete"
                typeToConfirm={history.targetValue}
                onConfirm={() => {
                  if (!history.targetId || !selectedWorkspaceId) return;

                  setMutatingHistoryId(history.id);
                  deleteTargetMutation.mutate({
                    id: history.targetId,
                    workspaceId: selectedWorkspaceId,
                  });
                }}
                trigger={
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    Delete domain
                  </Button>
                }
              />
            )}
          </div>
        );
      },
    },
  ];

  if (isError) {
    return (
      <div className="p-4">
        <div className="text-destructive">
          Error:{' '}
          {error instanceof Error ? error.message : 'Failed to load jobs'}
        </div>
      </div>
    );
  }

  return (
    <Page title="Jobs Registry">
      <DataTable
        isShowHeader={false}
        columns={columns}
        data={jobsData?.data || []}
        isLoading={isLoading}
        page={jobsData?.page || 1}
        pageSize={jobsData?.limit || 100}
        totalItems={jobsData?.total || 100}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(col, order) => {
          setParams({ sortBy: col, sortOrder: order, page: 1 });
        }}
        showPagination={true}
        onRowClick={(row) => {
          navigate(`/jobs/runs/${row.id}`);
        }}
      />
    </Page>
  );
};

export default JobsRegistryPage;
