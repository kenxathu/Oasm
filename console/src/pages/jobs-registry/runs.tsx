import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CodeBlock } from '@/components/common/code-block';
import Page from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import JobStatusBadge from '@/components/ui/job-status';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { updateJobHistoryPipeline } from '@/services/apis/jobs-registry';
import type { Job, Tool } from '@/services/apis/gen/queries';
import {
  JobStatus,
  ToolCategory,
  ToolsControllerGetManyToolsType,
  useJobsRegistryControllerCancelJob,
  useJobsRegistryControllerDeleteJob,
  useJobsRegistryControllerGetJobHistoryDetail,
  useToolsControllerGetInstalledTools,
} from '@/services/apis/gen/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  ArrowRight,
  Calendar,
  CircleCheck,
  Clock,
  Lock,
  Loader2Icon,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type JobHistoryDetailWithPipeline = {
  pipelineToolNames?: string[];
};
<<<<<<< HEAD
=======

const DEFAULT_PIPELINE_TOOL_NAMES = ['subfinder', 'naabu', 'httpx'];

const withDefaultPipelineTools = (toolNames: string[]) => {
  const uniqueToolNames = [...new Set(toolNames)];

  return [
    ...DEFAULT_PIPELINE_TOOL_NAMES,
    ...uniqueToolNames.filter(
      (toolName) => !DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName),
    ),
  ];
};
>>>>>>> main

export default function Runs() {
  const { id: jobHistoryId } = useParams<{ id: string }>();
  const [jobError, setJobError] = useState<Job | null>();
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const queryClient = useQueryClient();
  const { data: jobHistoryDetail } =
    useJobsRegistryControllerGetJobHistoryDetail(jobHistoryId || '', {
      query: {
        refetchInterval: 1000,
      },
    });
  const { data: workspaceToolsInstalled } = useToolsControllerGetInstalledTools();

  const { mutate: deleteJobMutate } = useJobsRegistryControllerDeleteJob();
  const { mutate: cancelJobMutate } = useJobsRegistryControllerCancelJob();
  const updatePipelineMutation = useMutation({
    mutationFn: updateJobHistoryPipeline,
    onSuccess: () => {
      toast.success('Pipeline updated successfully');
      void queryClient.invalidateQueries({
        queryKey: [`/api/jobs-registry/histories/${jobHistoryId}`],
      });
    },
    onError: () => toast.error('Failed to update pipeline'),
  });

  const jobHistoryPipeline = jobHistoryDetail as
    | (typeof jobHistoryDetail & JobHistoryDetailWithPipeline)
    | undefined;

  const pipelineToolNames = useMemo(() => {
<<<<<<< HEAD
    return (
      jobHistoryPipeline?.pipelineToolNames ||
      jobHistoryDetail?.tools?.map((tool) => tool.name) ||
      []
=======
    return withDefaultPipelineTools(
      jobHistoryPipeline?.pipelineToolNames ||
        jobHistoryDetail?.tools?.map((tool) => tool.name) ||
        [],
>>>>>>> main
    );
  }, [jobHistoryDetail?.tools, jobHistoryPipeline?.pipelineToolNames]);

  const scanTools = useMemo(() => {
    return (
      workspaceToolsInstalled?.data?.filter(
        (tool) =>
          (tool.type === ToolsControllerGetManyToolsType.provider ||
            tool.category !== ToolCategory.assistant) &&
          tool.category !== ToolCategory.assistant,
      ) || []
    );
  }, [workspaceToolsInstalled?.data]);

  const toolsByName = useMemo(() => {
    const tools = [...(jobHistoryDetail?.tools || []), ...scanTools];
    return new Map(tools.map((tool) => [tool.name, tool]));
  }, [jobHistoryDetail?.tools, scanTools]);

  const availableTools = useMemo(() => {
    const normalizedSearch = toolSearch.trim().toLowerCase();

    return scanTools.filter((tool) => {
      const alreadyInPipeline = pipelineToolNames.includes(tool.name);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        tool.name.toLowerCase().includes(normalizedSearch) ||
        tool.description?.toLowerCase().includes(normalizedSearch);

      return !alreadyInPipeline && matchesSearch;
    });
  }, [pipelineToolNames, scanTools, toolSearch]);

  const updatePipeline = (toolNames: string[]) => {
    if (!jobHistoryId) return;

    updatePipelineMutation.mutate({
      id: jobHistoryId,
      toolNames,
    });
  };

  const addToolToPipeline = (tool: Tool) => {
    updatePipeline([...pipelineToolNames, tool.name]);
    setIsAddToolOpen(false);
    setToolSearch('');
  };

  const removeToolFromPipeline = (toolName: string) => {
<<<<<<< HEAD
=======
    if (DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName)) return;

>>>>>>> main
    updatePipeline(pipelineToolNames.filter((name) => name !== toolName));
  };

  const jobsByToolName = useMemo(() => {
    if (!jobHistoryDetail?.jobs) return new Map<string, Job[]>();
    return jobHistoryDetail.jobs.reduce((acc, job) => {
      if (!job.tool) {
        console.warn(`Job ${job.id} has no tool assigned:`, job);
        return acc;
      }
      const toolName = job.tool.name;
      if (!acc.has(toolName)) {
        acc.set(toolName, []);
      }
      acc.get(toolName)!.push(job);
      return acc;
    }, new Map<string, Job[]>());
  }, [jobHistoryDetail?.jobs]);

  const getTitle = (row: Job) => {
    const value = row?.assetService
      ? `${row.assetService.value}`
      : row?.asset?.value;
    return value;
  };

  const columns: ColumnDef<Job>[] = [
    {
      accessorKey: 'status',
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-2">
            <JobStatusBadge
              onlyIcon
              status={row.original.status as JobStatus}
            />
            <pre>{getTitle(row.original)}</pre>
          </div>
        );
      },
    },
    {
      accessorKey: 'tool',
      cell: ({ row }) => (
        <div className="min-h-[60px] flex items-center">
          {row.original.tool ? (
            <Link
              to={`/tools/${row.original.tool.id}`}
              className="flex items-center gap-2"
            >
              <Image
                url={row.original.tool?.logoUrl}
                width={30}
                height={30}
                className="rounded-full"
              />
              <span className="capitalize font-bold">
                {row.original.tool.name}
              </span>
            </Link>
          ) : (
            <span className="text-muted-foreground">No tool assigned</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      cell: ({ row }) => {
        const updatedAt = dayjs(row.original.updatedAt);
        const pickJobAt = dayjs(row.original.pickJobAt);
        const completedAt = dayjs(row.original.completedAt);

        // Calculate duration only if all dates are valid and job is completed
        const isValidDates =
          pickJobAt.isValid() &&
          completedAt.isValid() &&
          row.original.status === JobStatus.completed;

        let durationDisplay = null;

        if (isValidDates) {
          const totalSeconds = completedAt.diff(pickJobAt, 'second');

          // Only display if duration is positive
          if (totalSeconds >= 0) {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const parts = [];
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            durationDisplay = parts.join(' ');
          }
        }

        return (
          <div className="text-sm text-muted-foreground flex flex-col gap-2">
            <span className="flex gap-2 items-center">
              <Calendar size={20} />
              {updatedAt.format('YYYY-MM-DD HH:mm:ss')}
            </span>

            {durationDisplay && (
              <span className="flex gap-2 items-center">
                <Clock size={20} />
                {durationDisplay}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const canCancel =
          row.original.status === JobStatus.pending ||
          row.original.status === JobStatus.in_progress;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-8 w-8 p-0 flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                {canCancel && (
                  <ConfirmDialog
                    title="Cancel Job"
                    description="Are you sure you want to cancel this job?"
                    onConfirm={() =>
                      cancelJobMutate(
                        { id: row.original.id },
                        {
                          onSuccess: () => {
                            void queryClient.invalidateQueries({
                              queryKey: [
                                `/api/jobs-registry/histories/${jobHistoryId}`,
                              ],
                            });
                          },
                        },
                      )
                    }
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Cancel
                      </DropdownMenuItem>
                    }
                  />
                )}
                <ConfirmDialog
                  title="Delete Job"
                  description="Are you sure you want to delete this job?"
                  onConfirm={() =>
                    deleteJobMutate(
                      { id: row.original.id },
                      {
                        onSuccess: () => {
                          void queryClient.invalidateQueries({
                            queryKey: [
                              `/api/jobs-registry/histories/${jobHistoryId}`,
                            ],
                          });
                        },
                      },
                    )
                  }
                  trigger={
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Delete
                    </DropdownMenuItem>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const getToolStatus = useMemo(() => {
    return (toolName: string, toolIndex: number) => {
      // Check if any previous tool in the workflow is still running or waiting
      for (let i = 0; i < toolIndex; i++) {
        const prevToolName = pipelineToolNames[i];
        const prevToolJobs = jobsByToolName.get(prevToolName) || [];

        if (prevToolJobs.length > 0) {
          const hasPrevRunning = prevToolJobs.some(
            (job) => job.status === JobStatus.in_progress,
          );
          if (hasPrevRunning) return 'pending'; // Changed from 'running' to 'pending'

          const allPrevCompleted = prevToolJobs.every(
            (job) => job.status === JobStatus.completed,
          );
          if (!allPrevCompleted) return 'pending'; // Changed from 'running' to 'pending'
        }
        // If previous tool has no jobs or is completed, continue to check current tool
      }

      // Check current tool jobs
      const currentToolJobs = jobsByToolName.get(toolName) || [];

      // If current tool has no jobs yet, it's pending
      if (currentToolJobs.length === 0) return 'pending';

      const hasFailed = currentToolJobs.some(
        (job) => job.status === JobStatus.failed,
      );
      if (hasFailed) return 'failed';

      const hasRunning = currentToolJobs.some(
        (job) => job.status === JobStatus.in_progress,
      );
      if (hasRunning) return 'running';

      const allCompleted = currentToolJobs.every(
        (job) => job.status === JobStatus.completed,
      );
      if (allCompleted) return 'completed';

      const allPending = currentToolJobs.every(
        (job) => job.status === JobStatus.pending,
      );
      if (allPending) return 'pending';

      // Mixed statuses - some pending, some running, some completed
      return 'running';
    };
  }, [jobsByToolName, pipelineToolNames]);

  // Memoize sorted jobs to avoid sorting on every render
  const sortedJobs = useMemo(() => {
    // Use .slice() to create a shallow copy before sorting to avoid mutating the original array
    return (jobHistoryDetail?.jobs || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [jobHistoryDetail?.jobs]);

  const navigate = useNavigate();
  return (
    <Page
      isShowButtonGoBack
      title={
        jobHistoryDetail?.jobHistoryName ||
        jobHistoryDetail?.workflowName ||
        'Job History Detail'
      }
    >
      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">Pipeline</h3>
          <Button
            size="sm"
            disabled={updatePipelineMutation.isPending}
            onClick={() => setIsAddToolOpen(true)}
          >
            <Plus />
            Add tool
          </Button>
        </div>
        {pipelineToolNames.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No tools in pipeline
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {pipelineToolNames.map((toolName, index) => {
              const tool = toolsByName.get(toolName);
              const status = getToolStatus(toolName, index);
<<<<<<< HEAD
=======
              const isDefaultTool =
                DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName);
>>>>>>> main

              return (
                <div key={`${toolName}-${index}`} className="flex items-center">
                  <div className="flex h-12 items-center gap-2 rounded-md border bg-background px-2">
                    {tool?.id ? (
                      <Link
                        to={`/tools/${tool.id}`}
                        className="flex items-center gap-2 hover:opacity-80"
                      >
                        <Image
                          url={tool.logoUrl}
                          width={32}
                          height={32}
                          className="rounded-full border"
                        />
                        <span className="text-sm font-medium capitalize">
                          {toolName}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-sm font-medium capitalize">
                        {toolName}
                      </span>
                    )}
                    {status === 'running' && (
                      <Loader2Icon className="animate-spin" />
                    )}
                    {status === 'completed' && (
                      <CircleCheck className="text-green-500" />
                    )}
                    {status === 'pending' && (
                      <Clock className="text-yellow-500" />
                    )}
                    {status === 'failed' && <X className="text-red-500" />}
<<<<<<< HEAD
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={updatePipelineMutation.isPending}
                          onClick={() => removeToolFromPipeline(toolName)}
                        >
                          <X />
                          <span className="sr-only">Remove {toolName}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
=======
                    {isDefaultTool ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Default tool</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={updatePipelineMutation.isPending}
                            onClick={() => removeToolFromPipeline(toolName)}
                          >
                            <X />
                            <span className="sr-only">Remove {toolName}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove</TooltipContent>
                      </Tooltip>
                    )}
>>>>>>> main
                  </div>
                  {index < pipelineToolNames.length - 1 && (
                    <ArrowRight className="mx-2 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isAddToolOpen} onOpenChange={setIsAddToolOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add tool</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={toolSearch}
              onChange={(event) => setToolSearch(event.target.value)}
              placeholder="Search tools"
            />
            <div className="max-h-[420px] overflow-auto rounded-md border">
              {availableTools.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No tools available
                </div>
              ) : (
                <div className="divide-y">
                  {availableTools.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary disabled:opacity-60"
                      disabled={updatePipelineMutation.isPending}
                      onClick={() => addToolToPipeline(tool)}
                    >
                      <Image
                        url={tool.logoUrl}
                        width={36}
                        height={36}
                        className="rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium capitalize">{tool.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {tool.category}
                        </div>
                      </div>
                      {updatePipelineMutation.isPending && (
                        <Loader2Icon className="animate-spin" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DataTable
        isShowHeader={false}
        columns={columns}
        data={sortedJobs}
        showColumnVisibility={true}
        showPagination={false}
        page={1}
        pageSize={jobHistoryDetail?.jobs?.length || 0}
        totalItems={jobHistoryDetail?.jobs?.length || 0}
        onRowClick={(row) => {
          if (row.status === JobStatus.failed) {
            setJobError(row);
            return;
          }
          const redirect = row.assetServiceId
            ? `/assets/${row.assetServiceId}`
            : `/assets?filter=${row?.asset?.value}`;
          navigate(redirect);
        }}
      />
      <Dialog open={!!jobError} onOpenChange={() => setJobError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{jobError && getTitle(jobError)}</DialogTitle>
            {jobError?.errorLogs.map((errorLog) => (
              <div className="mb-1 flex flex-col border-b-2" key={errorLog.id}>
                <CodeBlock
                  language="Payload"
                  value={String(errorLog.payload).replace(/\n$/, '')}
                />
                <CodeBlock
                  language="Log Message"
                  value={String(errorLog.logMessage).replace(/\n$/, '')}
                />
              </div>
            ))}
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
