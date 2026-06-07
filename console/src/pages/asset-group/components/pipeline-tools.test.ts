import { describe, expect, it } from 'vitest';
import { OnSchedule, type WorkflowContent } from '@/services/apis/gen/queries';
import {
  addToolToPipeline,
  createPipelineWorkflowContent,
  getPipelineToolNames,
  removeToolFromPipeline,
} from './pipeline-tools';

const baseContent: WorkflowContent = {
  name: 'Pipeline',
  on: {
    schedule: OnSchedule['0_0_*_*_*'],
    target: [],
  },
  jobs: [
    { name: 'subfinder', run: 'subfinder' },
    { name: 'httpx', run: 'httpx' },
  ],
};

describe('pipeline-tools', () => {
  it('appends a new tool to the pipeline without changing existing order', () => {
    const result = addToolToPipeline(baseContent, 'nuclei');

    expect(result.jobs.map((job) => job.run)).toEqual([
      'subfinder',
      'httpx',
      'nuclei',
    ]);
  });

  it('does not duplicate an existing tool', () => {
    const result = addToolToPipeline(baseContent, 'httpx');

    expect(result.jobs.map((job) => job.run)).toEqual(['subfinder', 'httpx']);
  });

  it('removes a tool from the pipeline', () => {
    const result = removeToolFromPipeline(baseContent, 'subfinder');

    expect(result.jobs.map((job) => job.run)).toEqual(['httpx']);
  });

  it('creates a new asset-group workflow with the selected tool', () => {
    const result = createPipelineWorkflowContent('group-1', 'nuclei');

    expect(result).toEqual({
      name: 'Group Workflow - group-1',
      on: {
        schedule: OnSchedule['0_0_*_*_*'],
        target: [],
      },
      jobs: [{ name: 'nuclei', run: 'nuclei' }],
    });
  });

  it('collects tool names across grouped workflows', () => {
    const result = getPipelineToolNames([
      { workflow: { content: baseContent } },
      {
        workflow: {
          content: {
            ...baseContent,
            jobs: [{ name: 'nuclei', run: 'nuclei' }],
          },
        },
      },
    ]);

    expect(result).toEqual(['subfinder', 'httpx', 'nuclei']);
  });
});
