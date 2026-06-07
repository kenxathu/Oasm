import { ScanScheduleSelect } from '@/components/scan-schedule-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import RunWorkflowButton from '@/pages/asset-group/components/run-workflow-button';
import {
  ToolCategory,
  type Tool,
  ToolsControllerGetManyToolsType,
  UpdateTargetDtoScanSchedule,
  useAssetGroupControllerAddManyWorkflows,
  useAssetGroupControllerGetWorkflowsByAssetGroupsId,
  useAssetGroupControllerRemoveManyWorkflows,
  useAssetGroupControllerUpdateAssetGroupWorkflow,
  useToolsControllerGetInstalledTools,
  useWorkflowsControllerCreateWorkflow,
  useWorkflowsControllerDeleteWorkflow,
  useWorkflowsControllerUpdateWorkflow,
} from '@/services/apis/gen/queries';
import {
  ArrowRight,
  Loader2Icon,
  Lock,
  MoveUpRight,
  Plus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  addToolToPipeline,
  createPipelineWorkflowContent,
  DEFAULT_PIPELINE_TOOL_NAMES,
  getPipelineToolNames,
  removeToolFromPipeline,
  withDefaultPipelineTools,
} from './pipeline-tools';

export default function AssetGroupWorkflow({
  assetGroupId,
}: {
  assetGroupId: string;
}) {
  const { data: groupWorkflows, refetch: refetchWorkflows } =
    useAssetGroupControllerGetWorkflowsByAssetGroupsId(assetGroupId);
  const { data: workspaceToolsInstalled } =
    useToolsControllerGetInstalledTools();
  const [isAddToolOpen, setIsAddToolOpen] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    mutate: updateAssetGroupWorkflowMutation,
    isPending: isPendingUpdateSchedule,
  } = useAssetGroupControllerUpdateAssetGroupWorkflow();
  const createWorkflowMutation = useWorkflowsControllerCreateWorkflow();
  const updateWorkflowMutation = useWorkflowsControllerUpdateWorkflow();
  const deleteWorkflowMutation = useWorkflowsControllerDeleteWorkflow();
  const addWorkflowsMutation = useAssetGroupControllerAddManyWorkflows();
  const removeWorkflowsMutation = useAssetGroupControllerRemoveManyWorkflows();

  const groupWorkflowItems = groupWorkflows?.data || [];
  const currentGroupWorkflow = groupWorkflowItems[0];
  const currentWorkflow = currentGroupWorkflow?.workflow;
  const currentPipelineJobs = useMemo(
    () =>
      currentWorkflow?.content
        ? withDefaultPipelineTools(currentWorkflow.content).jobs || []
        : [],
    [currentWorkflow?.content],
  );

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

  const pipelineToolNames = useMemo(
    () => getPipelineToolNames(groupWorkflowItems),
    [groupWorkflowItems],
  );

  const toolByName = useMemo(() => {
    return new Map(scanTools.map((tool) => [tool.name, tool]));
  }, [scanTools]);

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

  const getWorkflowContainingTool = (toolName: string) => {
    return groupWorkflowItems.find((groupWorkflow) => {
      const jobs = groupWorkflow.workflow.content?.jobs || [];
      return jobs.some((job) => job.run === toolName);
    });
  };

  const handleAddTool = async (tool: Tool) => {
    try {
      setIsProcessing(true);

      if (currentWorkflow) {
        await updateWorkflowMutation.mutateAsync({
          id: currentWorkflow.id,
          data: {
            content: addToolToPipeline(currentWorkflow.content, tool.name),
          },
        });
      } else {
        const createdWorkflow = await createWorkflowMutation.mutateAsync({
          data: {
            name: `Group Workflow - ${assetGroupId}`,
            content: createPipelineWorkflowContent(assetGroupId, tool.name),
            filePath: '',
          },
        });

        await addWorkflowsMutation.mutateAsync({
          groupId: assetGroupId,
          data: {
            workflowIds: [createdWorkflow.id],
          },
        });
      }

      setIsAddToolOpen(false);
      setToolSearch('');
      await refetchWorkflows();
      toast.success(`${tool.name} added to pipeline`);
    } catch (error) {
      console.error('Error adding tool:', error);
      toast.error('Failed to add tool. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveTool = async (toolName: string) => {
    if (DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName)) return;

    const workflow = getWorkflowContainingTool(toolName)?.workflow;

    if (!workflow) {
      toast.error('Workflow not found');
      return;
    }

    try {
      setIsProcessing(true);

      const updatedContent = removeToolFromPipeline(workflow.content, toolName);

      if (updatedContent.jobs.length === 0) {
        await removeWorkflowsMutation.mutateAsync({
          groupId: assetGroupId,
          data: {
            workflowIds: [workflow.id],
          },
        });

        await deleteWorkflowMutation.mutateAsync({
          id: workflow.id,
        });
      } else {
        await updateWorkflowMutation.mutateAsync({
          id: workflow.id,
          data: {
            content: updatedContent,
          },
        });
      }

      await refetchWorkflows();
      toast.success(`${toolName} removed from pipeline`);
    } catch (error) {
      console.error('Error removing tool from workflow:', error);
      toast.error('Failed to remove tool. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mb-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Pipeline</h2>
          <Dialog open={isAddToolOpen} onOpenChange={setIsAddToolOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={isProcessing}>
                <Plus />
                Add tool
              </Button>
            </DialogTrigger>
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
                          disabled={isProcessing}
                          onClick={() => handleAddTool(tool)}
                        >
                          <Image
                            url={tool.logoUrl}
                            width={36}
                            height={36}
                            className="rounded-full"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium capitalize">
                              {tool.name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {tool.category}
                            </div>
                          </div>
                          {isProcessing && (
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
        </div>

        <div className="flex gap-2">
          <ScanScheduleSelect
            disabled={isPendingUpdateSchedule || !currentGroupWorkflow?.id}
            value={currentGroupWorkflow?.schedule as UpdateTargetDtoScanSchedule}
            onChange={(value: UpdateTargetDtoScanSchedule) => {
              updateAssetGroupWorkflowMutation(
                {
                  id: currentGroupWorkflow?.id as string,
                  data: {
                    schedule: value,
                  },
                },
                {
                  onSuccess: async () => {
                    await refetchWorkflows();
                    toast.success('Update schedule successfuly');
                  },
                },
              );
            }}
          />
          <RunWorkflowButton id={currentGroupWorkflow?.id} />
        </div>
      </div>

      <div className="rounded-md border p-3">
        {scanTools.length === 0 ? (
          <div className="py-4">
            <Link
              className="text-blue-500 italic flex items-center gap-1 hover:underline"
              to={'/tools'}
            >
              Open Marketplace <MoveUpRight className="h-4 w-4" />
            </Link>
          </div>
        ) : currentPipelineJobs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No tools in pipeline
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {currentPipelineJobs.map((job, index) => {
              const tool = toolByName.get(job.run);
              const isDefaultTool = DEFAULT_PIPELINE_TOOL_NAMES.includes(
                job.run,
              );
              return (
                <div key={`${job.run}-${index}`} className="flex items-center">
                  <div className="flex h-12 items-center gap-2 rounded-md border bg-background px-2">
                    <Image
                      url={tool?.logoUrl}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                    <span className="text-sm font-medium capitalize">
                      {job.run}
                    </span>
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
                            disabled={isProcessing}
                            onClick={() => handleRemoveTool(job.run)}
                          >
                            <X />
                            <span className="sr-only">Remove {job.run}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {index < currentPipelineJobs.length - 1 && (
                    <ArrowRight className="mx-2 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
