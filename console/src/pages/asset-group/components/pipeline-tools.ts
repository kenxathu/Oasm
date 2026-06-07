import {
  OnSchedule,
  type WorkflowContent,
  type WorkflowJob,
} from '@/services/apis/gen/queries';

export type PipelineTool = {
  name: string;
};

const createPipelineJob = (toolName: string): WorkflowJob => ({
  name: toolName,
  run: toolName,
});

export const createPipelineWorkflowContent = (
  assetGroupId: string,
  toolName: string,
): WorkflowContent => {
  const name = `Group Workflow - ${assetGroupId}`;

  return {
    on: {
      schedule: OnSchedule['0_0_*_*_*'],
      target: [],
    },
    jobs: [createPipelineJob(toolName)],
    name,
  };
};

export const addToolToPipeline = (
  content: WorkflowContent,
  toolName: string,
): WorkflowContent => {
  const jobs = content.jobs || [];
  const exists = jobs.some((job) => job.run === toolName);

  if (exists) return content;

  return {
    ...content,
    jobs: [...jobs, createPipelineJob(toolName)],
  };
};

export const removeToolFromPipeline = (
  content: WorkflowContent,
  toolName: string,
): WorkflowContent => ({
  ...content,
  jobs: (content.jobs || []).filter((job) => job.run !== toolName),
});

export const getPipelineToolNames = (
  workflows: Array<{ workflow: { content?: WorkflowContent } }>,
): string[] => {
  return workflows.flatMap((groupWorkflow) =>
    (groupWorkflow.workflow.content?.jobs || []).map((job) => job.run),
  );
};
