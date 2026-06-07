import { JobStatus } from '@/common/enums/enum';
import { RedisService } from '@/services/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeysService } from '../apikeys/apikeys.service';
import { Asset } from '../assets/entities/assets.entity';
import { JobsRegistryService } from '../jobs-registry/jobs-registry.service';
import { InternalNetwork } from '../internal-networks/entities/internal-network.entity';
import { NetworkInterface } from '../internal-networks/entities/network-interface.entity';
import { WorkspaceTool } from '../tools/entities/workspace_tools.entity';
import { ToolsService } from '../tools/tools.service';
import { AliveStreamManager } from './alive-stream-manager.service';
import { WorkerInstance } from './entities/worker.entity';
import { WorkersService } from './workers.service';

type LooseMock = ReturnType<typeof jest.fn> & {
  mockResolvedValue(value: unknown): LooseMock;
  mockReturnValue(value: unknown): LooseMock;
  mockReturnValueOnce(value: unknown): LooseMock;
};

const mockFn = (): LooseMock => jest.fn() as LooseMock;

describe('WorkersService', () => {
  let service: WorkersService;
  let mockWorkerInstanceRepository: any;
  let mockAssetRepository: any;
  let mockWorkspaceToolRepository: any;
  let mockInternalNetworkRepository: any;
  let mockNetworkInterfaceRepository: any;
  let mockJobsRegistryService: any;
  let mockApiKeysService: any;
  let mockConfigService: any;
  let mockToolsService: any;
  let mockRedisService: any;
  let mockAliveStreamManager: any;

  beforeEach(async () => {
    mockWorkerInstanceRepository = {
      find: mockFn(),
      findOne: mockFn(),
      save: mockFn(),
      update: mockFn(),
      delete: mockFn(),
      createQueryBuilder: mockFn().mockReturnThis(),
      leftJoin: mockFn().mockReturnThis(),
      leftJoinAndSelect: mockFn().mockReturnThis(),
      where: mockFn().mockReturnThis(),
      andWhere: mockFn().mockReturnThis(),
      select: mockFn().mockReturnThis(),
      getOne: mockFn(),
      getOneOrFail: mockFn(),
      getMany: mockFn(),
      getManyAndCount: mockFn(),
      getRawMany: mockFn(),
      getRawOne: mockFn(),
    };

    mockAssetRepository = {
      findOne: mockFn(),
    };

    mockWorkspaceToolRepository = {
      findOne: mockFn(),
    };

    mockInternalNetworkRepository = {
      findOne: mockFn(),
    };

    mockNetworkInterfaceRepository = {
      insert: mockFn(),
    };

    mockJobsRegistryService = {
      repo: {
        createQueryBuilder: mockFn().mockReturnThis(),
        update: mockFn().mockReturnThis(),
        set: mockFn().mockReturnThis(),
        where: mockFn().mockReturnThis(),
        andWhere: mockFn().mockReturnThis(),
        execute: mockFn(),
      },
    };

    mockApiKeysService = {
      apiKeysRepository: {
        findOne: mockFn(),
      },
    };

    mockConfigService = {
      get: mockFn(),
    };

    mockToolsService = {
      getBuiltInTools: mockFn().mockResolvedValue({ data: [] }),
    };

    mockRedisService = {
      publish: mockFn(),
    };

    mockAliveStreamManager = {
      isActive: mockFn().mockReturnValue(false),
      register: mockFn().mockReturnValue('stream-1'),
      unregister: mockFn(),
      updateAlive: mockFn(),
      getActiveWorkerIds: mockFn().mockReturnValue(new Set()),
      getActiveStreamCount: mockFn().mockReturnValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkersService,
        {
          provide: getRepositoryToken(WorkerInstance),
          useValue: mockWorkerInstanceRepository,
        },
        {
          provide: getRepositoryToken(Asset),
          useValue: mockAssetRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceTool),
          useValue: mockWorkspaceToolRepository,
        },
        {
          provide: getRepositoryToken(InternalNetwork),
          useValue: mockInternalNetworkRepository,
        },
        {
          provide: getRepositoryToken(NetworkInterface),
          useValue: mockNetworkInterfaceRepository,
        },
        {
          provide: JobsRegistryService,
          useValue: mockJobsRegistryService,
        },
        {
          provide: ApiKeysService,
          useValue: mockApiKeysService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ToolsService,
          useValue: mockToolsService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AliveStreamManager,
          useValue: mockAliveStreamManager,
        },
      ],
    }).compile();

    service = module.get<WorkersService>(WorkersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('autoCleanupWorkersAndJobs', () => {
    it('should delete stale workers without active streams', async () => {
      const staleWorker = {
        id: 'worker-1',
        lastSeenAt: new Date(Date.now() - 120000),
      } as WorkerInstance;

      (mockWorkerInstanceRepository.find as LooseMock).mockResolvedValue([
        staleWorker,
      ]);
      (mockAliveStreamManager.isActive as LooseMock).mockReturnValue(false);

      // Mock workerLeave dependencies
      mockJobsRegistryService.repo.execute = mockFn();
      (mockWorkerInstanceRepository.delete as LooseMock).mockResolvedValue(
        undefined,
      );
      // Mock resetStuckAndFailedJobs
      (mockWorkerInstanceRepository.manager as any) = {
        query: mockFn().mockResolvedValue(undefined),
      };

      await service.autoCleanupWorkersAndJobs();

      expect(mockAliveStreamManager.isActive).toHaveBeenCalledWith(
        'worker-1',
      );
      expect(mockWorkerInstanceRepository.delete).toHaveBeenCalledWith(
        'worker-1',
      );
    });

    it('should skip stale workers that have active streams', async () => {
      const staleWorker = {
        id: 'worker-1',
        lastSeenAt: new Date(Date.now() - 120000),
      } as WorkerInstance;

      (mockWorkerInstanceRepository.find as LooseMock).mockResolvedValue([
        staleWorker,
      ]);
      (mockAliveStreamManager.isActive as LooseMock).mockReturnValue(true);

      // Mock resetStuckAndFailedJobs
      (mockWorkerInstanceRepository.manager as any) = {
        query: mockFn().mockResolvedValue(undefined),
      };

      await service.autoCleanupWorkersAndJobs();

      expect(mockAliveStreamManager.isActive).toHaveBeenCalledWith(
        'worker-1',
      );
      expect(mockWorkerInstanceRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle mixed workers: some active, some stale', async () => {
      const activeStreamWorker = {
        id: 'worker-1',
        lastSeenAt: new Date(Date.now() - 120000),
      } as WorkerInstance;
      const trulyStaleWorker = {
        id: 'worker-2',
        lastSeenAt: new Date(Date.now() - 120000),
      } as WorkerInstance;

      (mockWorkerInstanceRepository.find as LooseMock).mockResolvedValue([
        activeStreamWorker,
        trulyStaleWorker,
      ]);
      (mockAliveStreamManager.isActive as LooseMock)
        .mockReturnValueOnce(true) // worker-1 has active stream
        .mockReturnValueOnce(false); // worker-2 does not

      // Mock workerLeave dependencies
      mockJobsRegistryService.repo.execute = mockFn();
      (mockWorkerInstanceRepository.delete as LooseMock).mockResolvedValue(
        undefined,
      );
      // Mock resetStuckAndFailedJobs
      (mockWorkerInstanceRepository.manager as any) = {
        query: mockFn().mockResolvedValue(undefined),
      };

      await service.autoCleanupWorkersAndJobs();

      expect(mockWorkerInstanceRepository.delete).toHaveBeenCalledTimes(1);
      expect(mockWorkerInstanceRepository.delete).toHaveBeenCalledWith(
        'worker-2',
      );
    });

    it('should handle no stale workers', async () => {
      (mockWorkerInstanceRepository.find as LooseMock).mockResolvedValue([]);

      // Mock resetStuckAndFailedJobs
      (mockWorkerInstanceRepository.manager as any) = {
        query: mockFn().mockResolvedValue(undefined),
      };

      await service.autoCleanupWorkersAndJobs();

      expect(mockAliveStreamManager.isActive).not.toHaveBeenCalled();
      expect(mockWorkerInstanceRepository.delete).not.toHaveBeenCalled();
    });

    it('should not reset failed jobs when cleaning up unavailable workers', async () => {
      const query = mockFn().mockResolvedValue(undefined);
      (mockWorkerInstanceRepository.find as LooseMock).mockResolvedValue([]);
      (mockWorkerInstanceRepository.manager as any) = { query };

      await service.autoCleanupWorkersAndJobs();

      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][0]).not.toContain(
        `j.status = '${JobStatus.FAILED}'`,
      );
    });
  });
});
