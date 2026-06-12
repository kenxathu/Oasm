import { JobStatus, WorkerType } from '@/common/enums/enum';
import { DataAdapterService } from '@/modules/data-adapter/data-adapter.service';
import { StorageService } from '@/modules/storage/storage.service';
import { RedisService } from '@/services/redis/redis.service';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Job } from '../entities/job.entity';
import { JobsRegistryService } from '../jobs-registry.service';
import { JobResultProcessor } from './job-result.processor';

type MockFn = ReturnType<typeof jest.fn>;

describe('JobResultProcessor', () => {
  let processor: JobResultProcessor;
  let jobsRegistryService: Record<
    | 'findJobForUpdate'
    | 'getNextStepForJob'
    | 'handleJobError'
    | 'markWorkflowDone',
    MockFn
  >;
  let storageService: Record<'readJsonFile' | 'deleteFile', MockFn>;
  let jobRepo: { save: MockFn };
  let dataAdapterService: { syncData: MockFn };

  beforeEach(() => {
    jobsRegistryService = {
      findJobForUpdate: jest.fn(),
      getNextStepForJob: jest.fn(),
      handleJobError: jest.fn(),
      markWorkflowDone: jest.fn(),
    };
    storageService = {
      readJsonFile: jest.fn(),
      deleteFile: jest.fn(),
    };
    jobRepo = {
      save: jest.fn(),
    };
    dataAdapterService = {
      syncData: jest.fn(),
    };

    processor = new JobResultProcessor(
      jobsRegistryService as unknown as JobsRegistryService,
      dataAdapterService as unknown as DataAdapterService,
      { publish: jest.fn() } as unknown as RedisService,
      storageService as unknown as StorageService,
      jobRepo as never,
    );
  });

  it('should advance the pipeline when a tool result fails on the final attempt', async () => {
    const job = {
      id: 'job-1',
      isSaveData: false,
      isPublishEvent: false,
      tool: { type: WorkerType.PROVIDER },
      status: JobStatus.IN_PROGRESS,
      jobHistory: {
        id: 'history-1',
        workflow: {
          content: {
            jobs: [
              { name: 'probe', run: 'broken-tool' },
              { name: 'screenshot', run: 'next-tool' },
            ],
          },
        },
      },
      asset: {
        id: 'asset-1',
        target: { id: 'target-1' },
      },
    } as unknown as Job;

    jobsRegistryService.findJobForUpdate.mockResolvedValue(job);
    jobsRegistryService.getNextStepForJob.mockResolvedValue(1);
    storageService.readJsonFile.mockResolvedValue({
      error: true,
      raw: 'tool timeout',
      payload: [],
    });

    await expect(
      processor.process({
        data: {
          workerId: 'worker-1',
          jobId: job.id,
          resultRef: 'job-results/job-1.json',
        },
        attemptsMade: 0,
        opts: { attempts: 1 },
      } as never),
    ).rejects.toThrow('tool timeout');

    expect(jobsRegistryService.handleJobError).toHaveBeenCalledWith(
      { jobId: job.id, data: { error: true, raw: 'tool timeout', payload: [] } },
      job,
      expect.objectContaining({ message: 'tool timeout' }),
    );
    expect(jobsRegistryService.getNextStepForJob).toHaveBeenCalledWith(job);
    expect(jobsRegistryService.markWorkflowDone).not.toHaveBeenCalled();
    expect(dataAdapterService.syncData).not.toHaveBeenCalled();
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'job-1.json',
      'job-results',
    );
  });

  it('should report built-in worker errors before parsing raw scanner output', async () => {
    const job = {
      id: 'job-2',
      isSaveData: true,
      isPublishEvent: false,
      tool: { name: 'nuclei', type: WorkerType.BUILT_IN },
      status: JobStatus.IN_PROGRESS,
      jobHistory: { id: 'history-1' },
      asset: {
        id: 'asset-1',
        target: { id: 'target-1' },
      },
    } as unknown as Job;

    jobsRegistryService.findJobForUpdate.mockResolvedValue(job);
    jobsRegistryService.getNextStepForJob.mockResolvedValue(0);
    storageService.readJsonFile.mockResolvedValue({
      error: true,
      raw: 'Nuclei templates are not installed at /home/worker/nuclei-templates',
    });

    await expect(
      processor.process({
        data: {
          workerId: 'worker-1',
          jobId: job.id,
          resultRef: 'job-results/job-2.json',
        },
        attemptsMade: 0,
        opts: { attempts: 1 },
      } as never),
    ).rejects.toThrow(
      'Nuclei templates are not installed at /home/worker/nuclei-templates',
    );

    expect(jobsRegistryService.handleJobError).toHaveBeenCalledWith(
      {
        jobId: job.id,
        data: {
          error: true,
          raw: 'Nuclei templates are not installed at /home/worker/nuclei-templates',
        },
      },
      job,
      expect.objectContaining({
        message:
          'Nuclei templates are not installed at /home/worker/nuclei-templates',
      }),
    );
    expect(dataAdapterService.syncData).not.toHaveBeenCalled();
  });
});
