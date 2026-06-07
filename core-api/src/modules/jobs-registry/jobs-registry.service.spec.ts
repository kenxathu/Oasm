import { BullMQName, JobStatus } from '@/common/enums/enum';
import { RedisService } from '@/services/redis/redis.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DataAdapterService } from '../data-adapter/data-adapter.service';
import { StorageService } from '../storage/storage.service';
import { ToolsService } from '../tools/tools.service';
import { JobErrorLog } from './entities/job-error-log.entity';
import { JobHistory } from './entities/job-history.entity';
import { Job } from './entities/job.entity';
import { JobsRegistryService } from './jobs-registry.service';

type LooseMock = ReturnType<typeof jest.fn> & {
  mockRejectedValue(value: unknown): LooseMock;
  mockResolvedValue(value: unknown): LooseMock;
  mockResolvedValueOnce(value: unknown): LooseMock;
  mockReturnThis(): LooseMock;
  mockReturnValue(value: unknown): LooseMock;
};

const mockFn = (): LooseMock => jest.fn();

describe('JobsRegistryService', () => {
  let service: JobsRegistryService;

  const mockJobRepository = {
    createQueryBuilder: mockFn().mockReturnThis(),
    innerJoin: mockFn().mockReturnThis(),
    where: mockFn().mockReturnThis(),
    andWhere: mockFn().mockReturnThis(),
    getOne: mockFn(),
    findOne: mockFn(),
    save: mockFn(),
    update: mockFn(),
    count: mockFn(),
    exists: mockFn(),
  };

  const mockJobHistoryRepository = {
    createQueryBuilder: mockFn(),
    findOne: mockFn(),
    save: mockFn(),
    update: mockFn(),
  };

  const mockJobErrorLogRepository = {
    createQueryBuilder: mockFn(),
  };

  const mockDataSource = {
    createQueryRunner: mockFn(),
    getRepository: mockFn(),
    query: mockFn(),
  };

  const mockDataAdapterService = {
    syncData: mockFn(),
  };

  const mockStorageService = {
    upload: mockFn(),
  };

  const mockRedisService = {
    publish: mockFn(),
    client: {
      incr: mockFn(),
      decr: mockFn(),
      del: mockFn(),
      get: mockFn(),
      set: mockFn(),
    },
  };

  const mockToolsService = {
    getInstalledTools: mockFn(),
    getToolByNames: mockFn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(Job),
          useValue: mockJobRepository,
        },
        {
          provide: getRepositoryToken(JobHistory),
          useValue: mockJobHistoryRepository,
        },
        {
          provide: getRepositoryToken(JobErrorLog),
          useValue: mockJobErrorLogRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: DataAdapterService,
          useValue: mockDataAdapterService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ToolsService,
          useValue: mockToolsService,
        },
        {
          provide: getQueueToken(BullMQName.JOB_RESULT),
          useValue: { add: mockFn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: mockFn() },
        },
        JobsRegistryService,
      ],
    }).compile();

    service = module.get<JobsRegistryService>(JobsRegistryService);
    // Manually set optional toolsService since @Optional() dependencies may not be injected in tests
    (service as any).toolsService = mockToolsService;
  });

  describe('getScanActivity', () => {
    it('should return workspace workers and recent scan logs', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'worker-uuid',
            name: 'worker-1',
            os: 'linux',
            ipAddress: '127.0.0.1',
            type: 'built_in',
            scope: 'cloud',
            lastSeenAt: new Date(),
            currentJobsCount: '1',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'job-uuid',
            status: JobStatus.IN_PROGRESS,
            createdAt: new Date('2026-06-05T10:00:00.000Z'),
            updatedAt: new Date('2026-06-05T10:01:00.000Z'),
            pickJobAt: new Date('2026-06-05T10:00:30.000Z'),
            completedAt: null,
            workerId: 'worker-uuid',
            command: 'subfinder -d example.com',
            jobRunType: 'manual',
            targetId: 'target-uuid',
            target: 'example.com',
            asset: 'example.com',
            tool: 'subfinder',
            workerName: 'worker-1',
            errorLogs: [],
          },
        ]);

      const result = await service.getScanActivity('workspace-uuid');

      expect(result).toMatchObject({
        activeJobsCount: 1,
        pendingJobsCount: 0,
        workers: [
          {
            id: 'worker-uuid',
            name: 'worker-1',
            currentJobsCount: 1,
            isOnline: true,
          },
        ],
        logs: [
          {
            id: 'job-uuid',
            status: JobStatus.IN_PROGRESS,
            message: 'worker-1 is running subfinder on example.com',
            target: 'example.com',
            asset: 'example.com',
            tool: 'subfinder',
            workerId: 'worker-uuid',
          },
        ],
      });
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('reRunJob', () => {
    const mockWorkspaceId = 'workspace-uuid';
    const mockJobId = 'job-uuid';
    const mockJob = {
      id: mockJobId,
      status: JobStatus.COMPLETED,
      workerId: 'worker-uuid',
      retryCount: 0,
      asset: {
        target: {
          id: 'target-uuid',
        },
      },
    };

    it('should successfully re-run a job', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          save: mockFn().mockResolvedValue({
            ...mockJob,
            status: JobStatus.PENDING,
            workerId: undefined,
            retryCount: 1,
          }),
        },
        commitTransaction: mockFn(),
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockResolvedValue(mockJob);

      const result = await service.reRunJob(mockWorkspaceId, mockJobId);

      expect(mockJobRepository.createQueryBuilder).toHaveBeenCalledWith('job');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Job re-run successfully' });

      // Verify the job was updated correctly
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith({
        ...mockJob,
        status: JobStatus.PENDING,
        workerId: undefined,
        retryCount: 1,
      });
    });

    it('should throw NotFoundException when job not found in workspace', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          createQueryBuilder: mockFn().mockReturnThis(),
          innerJoin: mockFn().mockReturnThis(),
          where: mockFn().mockReturnThis(),
          andWhere: mockFn().mockReturnThis(),
          getOne: mockFn().mockResolvedValue(null),
        },
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockResolvedValue(null);

      await expect(
        service.reRunJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.reRunJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow('Job not found in workspace');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction when error occurs', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          save: mockFn(),
        },
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.reRunJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('cancelJob', () => {
    const mockWorkspaceId = 'workspace-uuid';
    const mockJobId = 'job-uuid';
    const mockJob = {
      id: mockJobId,
      status: JobStatus.IN_PROGRESS,
      workerId: 'worker-uuid',
      retryCount: 0,
      asset: {
        target: {
          id: 'target-uuid',
        },
      },
    };

    it('should successfully cancel a job', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          save: mockFn().mockResolvedValue({
            ...mockJob,
            status: JobStatus.CANCELLED,
          }),
        },
        commitTransaction: mockFn(),
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockResolvedValue(mockJob);

      const result = await service.cancelJob(mockWorkspaceId, mockJobId);

      expect(mockJobRepository.createQueryBuilder).toHaveBeenCalledWith('job');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Job cancelled successfully' });

      // Verify the job status was updated to cancelled
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith({
        ...mockJob,
        status: JobStatus.CANCELLED,
      });
    });

    it('should throw NotFoundException when job not found in workspace', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          createQueryBuilder: mockFn().mockReturnThis(),
          innerJoin: mockFn().mockReturnThis(),
          where: mockFn().mockReturnThis(),
          andWhere: mockFn().mockReturnThis(),
          getOne: mockFn().mockResolvedValue(null),
        },
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockResolvedValue(null);

      await expect(
        service.cancelJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.cancelJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow('Job not found in workspace');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction when error occurs', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          createQueryBuilder: mockFn().mockReturnThis(),
          innerJoin: mockFn().mockReturnThis(),
          where: mockFn().mockReturnThis(),
          andWhere: mockFn().mockReturnThis(),
          getOne: mockFn().mockRejectedValue(new Error('Database error')),
        },
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.cancelJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('deleteJob', () => {
    const mockWorkspaceId = 'workspace-uuid';
    const mockJobId = 'job-uuid';
    const mockJob = {
      id: mockJobId,
      status: JobStatus.COMPLETED,
      workerId: 'worker-uuid',
      retryCount: 0,
      asset: {
        target: {
          id: 'target-uuid',
        },
      },
    };

    it('should successfully delete a job', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          remove: mockFn().mockResolvedValue(mockJob),
        },
        commitTransaction: mockFn(),
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockResolvedValue(mockJob);

      const result = await service.deleteJob(mockWorkspaceId, mockJobId);

      expect(mockJobRepository.createQueryBuilder).toHaveBeenCalledWith('job');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Job deleted successfully' });

      // Verify the job was removed
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(mockJob);
    });

    it('should throw NotFoundException when job not found in workspace', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          createQueryBuilder: mockFn().mockReturnThis(),
          innerJoin: mockFn().mockReturnThis(),
          where: mockFn().mockReturnThis(),
          andWhere: mockFn().mockReturnThis(),
          getOne: mockFn().mockResolvedValue(null),
        },
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockResolvedValue(null);

      await expect(
        service.deleteJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.deleteJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow('Job not found in workspace');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction when error occurs', async () => {
      const mockQueryRunner = {
        connect: mockFn(),
        startTransaction: mockFn(),
        manager: {
          createQueryBuilder: mockFn().mockReturnThis(),
          innerJoin: mockFn().mockReturnThis(),
          where: mockFn().mockReturnThis(),
          andWhere: mockFn().mockReturnThis(),
          getOne: mockFn().mockRejectedValue(new Error('Database error')),
        },
        rollbackTransaction: mockFn(),
        release: mockFn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockJobRepository.getOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.deleteJob(mockWorkspaceId, mockJobId),
      ).rejects.toThrow('Database error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('scan history controls', () => {
    const mockWorkspaceId = 'workspace-uuid';
    const mockHistoryId = 'history-uuid';

    beforeEach(() => {
      mockJobHistoryRepository.createQueryBuilder.mockReturnValue({
        innerJoin: mockFn().mockReturnThis(),
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        getExists: mockFn().mockResolvedValue(true),
      });
    });

    it('should stop a scan history by cancelling active and pending jobs', async () => {
      mockJobRepository.update.mockResolvedValue({ affected: 3 });

      const result = await service.stopJobHistory(
        mockWorkspaceId,
        mockHistoryId,
      );

      expect(mockJobRepository.update).toHaveBeenCalledWith(
        {
          jobHistory: { id: mockHistoryId },
          status: expect.anything(),
        },
        {
          status: JobStatus.CANCELLED,
          workerId: undefined,
        },
      );
      expect(result).toEqual({ message: 'Scan stopped successfully' });
    });

    it('should start a scan history by moving cancelled and failed jobs back to pending', async () => {
      mockJobRepository.update.mockResolvedValue({ affected: 2 });

      const result = await service.startJobHistory(
        mockWorkspaceId,
        mockHistoryId,
      );

      expect(mockJobRepository.update).toHaveBeenCalledWith(
        {
          jobHistory: { id: mockHistoryId },
          status: expect.anything(),
        },
        {
          status: JobStatus.PENDING,
          workerId: undefined,
          retryCount: expect.any(Function),
        },
      );
      expect(result).toEqual({ message: 'Scan started successfully' });
    });

    it('should throw NotFoundException when stopping a scan history outside the workspace', async () => {
      mockJobHistoryRepository.createQueryBuilder.mockReturnValue({
        innerJoin: mockFn().mockReturnThis(),
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        getExists: mockFn().mockResolvedValue(false),
      });

      await expect(
        service.stopJobHistory(mockWorkspaceId, mockHistoryId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getJobHistoryDetail', () => {
    const mockWorkspaceId = 'workspace-uuid';
    const mockHistoryId = 'history-uuid';
    const mockJobs = [
      {
        id: 'job-1',
        status: JobStatus.COMPLETED,
        tool: { name: 'test-tool' },
      },
    ];
    const mockJobHistory = {
      id: mockHistoryId,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: mockJobs,
      workflow: {
        name: 'test-workflow',
        content: {
          jobs: [{ run: 'test-tool' }],
        },
      },
      jobHistoryName: 'test-job-history',
    };

    it('should return job history detail with jobs', async () => {
      mockJobHistoryRepository.findOne.mockResolvedValue(mockJobHistory);
      mockJobHistoryRepository.createQueryBuilder.mockReturnValue({
        innerJoin: mockFn().mockReturnThis(),
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        getExists: mockFn().mockResolvedValue(true),
      });
      mockToolsService.getInstalledTools.mockResolvedValue({
        data: [{ name: 'test-tool' }],
      });

      const result = await service.getJobHistoryDetail(
        mockWorkspaceId,
        mockHistoryId,
      );

      expect(mockJobHistoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockHistoryId },
        relations: {
          workflow: true,
          jobs: {
            tool: true,
            asset: { target: true },
            assetService: true,
            errorLogs: true,
          },
        },
      });
      expect(result).toEqual({
        id: mockHistoryId,
        workflowName: 'test-workflow',
        jobHistoryName: 'test-job-history',
        createdAt: mockJobHistory.createdAt,
        updatedAt: mockJobHistory.updatedAt,
        tools: [{ name: 'test-tool' }],
        pipelineToolNames: ['test-tool'],
        jobs: mockJobs,
      });
    });

    it('should throw NotFoundException when job history not found', async () => {
      mockJobHistoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getJobHistoryDetail(mockWorkspaceId, mockHistoryId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when job history not in workspace', async () => {
      mockJobHistoryRepository.findOne.mockResolvedValue(mockJobHistory);
      mockJobHistoryRepository.createQueryBuilder.mockReturnValue({
        innerJoin: mockFn().mockReturnThis(),
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        getExists: mockFn().mockResolvedValue(false),
      });

      await expect(
        service.getJobHistoryDetail(mockWorkspaceId, mockHistoryId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateJobHistoryPipeline', () => {
    const mockWorkspaceId = 'workspace-uuid';
    const mockHistoryId = 'history-uuid';
    const mockWorkflow = {
      id: 'workflow-uuid',
      name: 'Pipeline workflow',
      content: {
        name: 'Pipeline workflow',
        on: {
          target: [],
        },
        jobs: [
          { name: 'subfinder', run: 'subfinder' },
          { name: 'nuclei', run: 'nuclei' },
        ],
      },
    };
    const mockJobHistory = {
      id: mockHistoryId,
      workflow: mockWorkflow,
    };
    const mockWorkflowRepository = {
      save: mockFn(),
    };

    beforeEach(() => {
      mockWorkflow.content.jobs = [
        { name: 'subfinder', run: 'subfinder' },
        { name: 'nuclei', run: 'nuclei' },
      ];
      mockJobHistoryRepository.findOne.mockResolvedValue(mockJobHistory);
      mockJobHistoryRepository.createQueryBuilder.mockReturnValue({
        innerJoin: mockFn().mockReturnThis(),
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        getExists: mockFn().mockResolvedValue(true),
      });
      mockToolsService.getInstalledTools.mockResolvedValue({
        data: [
          { id: 'tool-subfinder', name: 'subfinder' },
          { id: 'tool-httpx', name: 'httpx' },
        ],
      });
      mockDataSource.getRepository.mockReturnValue(mockWorkflowRepository);
      mockWorkflowRepository.save.mockResolvedValue(mockWorkflow);
      mockJobRepository.update.mockResolvedValue({ affected: 1 });
    });

    it('should replace the workflow pipeline with requested installed tools', async () => {
      const result = await service.updateJobHistoryPipeline(
        mockWorkspaceId,
        mockHistoryId,
        { toolNames: ['subfinder', 'httpx'] },
      );

      expect(mockJobHistoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockHistoryId },
        relations: {
          workflow: true,
        },
      });
      expect(mockJobHistory.workflow.content.jobs).toEqual([
        { name: 'subfinder', run: 'subfinder' },
        { name: 'httpx', run: 'httpx' },
      ]);
      expect(mockWorkflowRepository.save).toHaveBeenCalledWith(mockWorkflow);
      expect(result).toEqual({ message: 'Pipeline updated successfully' });
    });

    it('should cancel pending and active jobs for tools removed from the pipeline', async () => {
      await service.updateJobHistoryPipeline(mockWorkspaceId, mockHistoryId, {
        toolNames: ['subfinder'],
      });

      expect(mockJobRepository.update).toHaveBeenCalledWith(
        {
          jobHistory: { id: mockHistoryId },
          tool: { name: expect.anything() },
          status: expect.anything(),
        },
        {
          status: JobStatus.CANCELLED,
          workerId: undefined,
        },
      );
    });

    it('should reject tools that are not installed in the workspace', async () => {
      await expect(
        service.updateJobHistoryPipeline(mockWorkspaceId, mockHistoryId, {
          toolNames: ['subfinder', 'missing-tool'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getNextStepForJob', () => {
    const mockJob = {
      id: 'job-uuid',
      tool: { name: 'tool-a' },
      asset: {
        target: { id: 'target-uuid' },
      },
      jobHistory: {
        workflow: {
          content: {
            jobs: [
              { name: 'job-1', run: 'tool-a' },
              { name: 'job-2', run: 'tool-b' },
            ],
          },
          workspace: { id: 'workspace-uuid' },
        },
      },
    };

    it('should return 0 when no workflow exists', async () => {
      const jobNoWorkflow = { ...mockJob, jobHistory: { workflow: null } };

      const result = await service.getNextStepForJob(jobNoWorkflow as any);

      expect(result).toBe(0);
    });

    it('should return 0 when current tool not found in workflow', async () => {
      const jobNoTool = {
        ...mockJob,
        tool: { name: 'unknown-tool' },
      };

      const result = await service.getNextStepForJob(jobNoTool as any);

      expect(result).toBe(0);
    });

    it('should return 0 when current tool is last in workflow', async () => {
      const lastToolJob = {
        ...mockJob,
        tool: { name: 'tool-b' },
      };

      const result = await service.getNextStepForJob(lastToolJob as any);

      expect(result).toBe(0);
    });

    it('should return number of new jobs created when next step exists', async () => {
      const jobWithNextStep = {
        id: 'job-uuid',
        tool: { name: 'tool-a' },
        asset: {
          target: { id: 'target-uuid' },
        },
        jobHistory: {
          workflow: {
            content: {
              jobs: [
                { name: 'job-1', run: 'tool-a' },
                { name: 'job-2', run: 'tool-b' },
              ],
            },
            workspace: { id: undefined },
          },
        },
      };

      mockToolsService.getToolByNames.mockResolvedValue([
        { name: 'tool-b', priority: 4, category: 'SUBDOMAINS' },
      ]);

      const mockQueryBuilder = {
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        getMany: mockFn().mockResolvedValue([{ id: 'asset-1', isPrimary: true }]),
      };
      const mockJobRepo = {
        create: mockFn().mockReturnValue({}),
        save: mockFn().mockResolvedValue([{}]),
        createQueryBuilder: mockFn().mockReturnValue(mockQueryBuilder),
      };
      mockDataSource.getRepository.mockReturnValue(mockJobRepo);

      const result = await service.getNextStepForJob(jobWithNextStep as any);

      expect(result).toBe(1);
    });
  });

  describe('markWorkflowDone', () => {
    const mockJobHistoryId = 'history-uuid';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update job history isCompleted to true', async () => {
      mockJobRepository.exists.mockResolvedValue(false);
      mockJobHistoryRepository.update.mockResolvedValue({ affected: 1 });
      mockJobHistoryRepository.findOne.mockResolvedValue({
        id: mockJobHistoryId,
        workflow: { name: 'test-workflow' },
      });

      await service.markWorkflowDone(mockJobHistoryId);

      expect(mockJobRepository.exists).toHaveBeenCalled();
      expect(mockJobHistoryRepository.update).toHaveBeenCalledWith(
        { id: mockJobHistoryId, isCompleted: false },
        { isCompleted: true },
      );
    });

    it('should not update when there are pending jobs', async () => {
      mockJobRepository.exists.mockResolvedValue(true);

      await service.markWorkflowDone(mockJobHistoryId);

      expect(mockJobHistoryRepository.update).not.toHaveBeenCalled();
    });

    it('should not update when already completed', async () => {
      mockJobRepository.exists.mockResolvedValue(false);
      mockJobHistoryRepository.update.mockResolvedValue({ affected: 0 });

      await service.markWorkflowDone(mockJobHistoryId);

      expect(mockJobHistoryRepository.update).toHaveBeenCalled();
    });
  });
});
