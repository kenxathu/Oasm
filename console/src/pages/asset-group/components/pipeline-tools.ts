import {
  OnSchedule,
  type WorkflowContent,
  type WorkflowJob,
} from '@/services/apis/gen/queries';

export type PipelineTool = {
  name: string;
};

<<<<<<< HEAD
=======
export const DEFAULT_PIPELINE_TOOL_NAMES = ['subfinder', 'naabu', 'httpx'];

>>>>>>> main
const createPipelineJob = (toolName: string): WorkflowJob => ({
  name: toolName,
  run: toolName,
});

<<<<<<< HEAD
=======
export const withDefaultPipelineTools = (
  content: WorkflowContent,
): WorkflowContent => {
  const jobs = content.jobs || [];
  const toolNames = [
    ...DEFAULT_PIPELINE_TOOL_NAMES,
    ...jobs
      .map((job) => job.run)
      .filter((toolName) => !DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName)),
  ];
  const uniqueToolNames = [...new Set(toolNames)];

  return {
    ...content,
    jobs: uniqueToolNames.map(createPipelineJob),
  };
};

>>>>>>> main
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
<<<<<<< HEAD
    jobs: [createPipelineJob(toolName)],
=======
    jobs: [
      ...DEFAULT_PIPELINE_TOOL_NAMES,
      ...(!DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName) ? [toolName] : []),
    ].map(createPipelineJob),
>>>>>>> main
    name,
  };
};

export const addToolToPipeline = (
  content: WorkflowContent,
  toolName: string,
): WorkflowContent => {
  const jobs = content.jobs || [];
  const exists = jobs.some((job) => job.run === toolName);

<<<<<<< HEAD
  if (exists) return content;

  return {
    ...content,
    jobs: [...jobs, createPipelineJob(toolName)],
  };
=======
  if (exists) return withDefaultPipelineTools(content);

  return withDefaultPipelineTools({
    ...content,
    jobs: [...jobs, createPipelineJob(toolName)],
  });
>>>>>>> main
};

export const removeToolFromPipeline = (
  content: WorkflowContent,
  toolName: string,
<<<<<<< HEAD
): WorkflowContent => ({
  ...content,
  jobs: (content.jobs || []).filter((job) => job.run !== toolName),
});
=======
): WorkflowContent => {
  if (DEFAULT_PIPELINE_TOOL_NAMES.includes(toolName)) {
    return withDefaultPipelineTools(content);
  }

  return withDefaultPipelineTools({
    ...content,
    jobs: (content.jobs || []).filter((job) => job.run !== toolName),
  });
};
>>>>>>> main

export const getPipelineToolNames = (
  workflows: Array<{ workflow: { content?: WorkflowContent } }>,
): string[] => {
  return workflows.flatMap((groupWorkflow) =>
    (groupWorkflow.workflow.content?.jobs || []).map((job) => job.run),
  );
};
