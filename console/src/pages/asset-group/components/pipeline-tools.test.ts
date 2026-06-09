import { describe, expect, it } from 'vitest';
import { OnSchedule, type WorkflowContent } from '@/services/apis/gen/queries';
import {
  addToolToPipeline,
  createPipelineWorkflowContent,
  getPipelineToolNames,
  removeToolFromPipeline,
<<<<<<< HEAD
=======
  withDefaultPipelineTools,
>>>>>>> main
} from './pipeline-tools';

const baseContent: WorkflowContent = {
  name: 'Pipeline',
  on: {
    schedule: OnSchedule['0_0_*_*_*'],
    target: [],
  },
  jobs: [
    { name: 'subfinder', run: 'subfinder' },
<<<<<<< HEAD
=======
    { name: 'naabu', run: 'naabu' },
>>>>>>> main
    { name: 'httpx', run: 'httpx' },
  ],
};

describe('pipeline-tools', () => {
  it('appends a new tool to the pipeline without changing existing order', () => {
    const result = addToolToPipeline(baseContent, 'nuclei');

    expect(result.jobs.map((job) => job.run)).toEqual([
      'subfinder',
<<<<<<< HEAD
=======
      'naabu',
>>>>>>> main
      'httpx',
      'nuclei',
    ]);
  });

  it('does not duplicate an existing tool', () => {
    const result = addToolToPipeline(baseContent, 'httpx');

<<<<<<< HEAD
    expect(result.jobs.map((job) => job.run)).toEqual(['subfinder', 'httpx']);
  });

  it('removes a tool from the pipeline', () => {
    const result = removeToolFromPipeline(baseContent, 'subfinder');

    expect(result.jobs.map((job) => job.run)).toEqual(['httpx']);
=======
    expect(result.jobs.map((job) => job.run)).toEqual([
      'subfinder',
      'naabu',
      'httpx',
    ]);
  });

  it('does not remove default tools from the pipeline', () => {
    const result = removeToolFromPipeline(baseContent, 'subfinder');

    expect(result.jobs.map((job) => job.run)).toEqual([
      'subfinder',
      'naabu',
      'httpx',
    ]);
  });

  it('removes a custom tool from the pipeline', () => {
    const content = addToolToPipeline(baseContent, 'nuclei');
    const result = removeToolFromPipeline(content, 'nuclei');

    expect(result.jobs.map((job) => job.run)).toEqual([
      'subfinder',
      'naabu',
      'httpx',
    ]);
>>>>>>> main
  });

  it('creates a new asset-group workflow with the selected tool', () => {
    const result = createPipelineWorkflowContent('group-1', 'nuclei');

    expect(result).toEqual({
      name: 'Group Workflow - group-1',
      on: {
        schedule: OnSchedule['0_0_*_*_*'],
        target: [],
      },
<<<<<<< HEAD
      jobs: [{ name: 'nuclei', run: 'nuclei' }],
    });
=======
      jobs: [
        { name: 'subfinder', run: 'subfinder' },
        { name: 'naabu', run: 'naabu' },
        { name: 'httpx', run: 'httpx' },
        { name: 'nuclei', run: 'nuclei' },
      ],
    });
  });

  it('adds default tools to existing legacy pipeline content', () => {
    const result = withDefaultPipelineTools({
      ...baseContent,
      jobs: [{ name: 'nuclei', run: 'nuclei' }],
    });

    expect(result.jobs.map((job) => job.run)).toEqual([
      'subfinder',
      'naabu',
      'httpx',
      'nuclei',
    ]);
>>>>>>> main
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

<<<<<<< HEAD
    expect(result).toEqual(['subfinder', 'httpx', 'nuclei']);
=======
    expect(result).toEqual(['subfinder', 'naabu', 'httpx', 'nuclei']);
>>>>>>> main
  });
});
