import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import type { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BullMQName, CronSchedule, JobRunType } from '@/common/enums/enum';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TargetsService } from '../targets/targets.service';
import { JobsRegistryService } from '../jobs-registry/jobs-registry.service';
import { ToolsService } from '../tools/tools.service';
import { WorkflowsService } from '../workflows/workflows.service';
import type { CreateInternalNetworkDto } from './dtos/create-internal-network.dto';
import type { GetManyInternalNetworksQueryDto } from './dtos/get-many-internal-networks.dto';
import type {
  GetManyNetworkInterfacesQueryDto,
} from './dtos/get-many-network-interfaces.dto';
import type { UpdateInternalNetworkDto } from './dtos/update-internal-network.dto';
import { InternalNetwork } from './entities/internal-network.entity';
import { NetworkInterface } from './entities/network-interface.entity';
import { InternalNetworksService } from './internal-networks.service';
import { SortOrder } from '@/common/dtos/get-many-base.dto';
import { WorkerInstance } from '../workers/entities/worker.entity';

describe('InternalNetworksService', () => {
  let service: InternalNetworksService;
  let internalNetworkRepo: Repository<InternalNetwork>;
  let networkInterfaceRepo: Repository<NetworkInterface>;
  let workspacesService: WorkspacesService;
  let workerRepository: Repository<WorkerInstance>;
  let scheduleQueue: { add: jest.Mock; removeJobScheduler: jest.Mock };
  let jobsRegistryService: Partial<JobsRegistryService>;
  let toolsService: Partial<ToolsService>;
  let workflowsService: Partial<WorkflowsService>;

  beforeEach(async () => {
    scheduleQueue = {
      add: jest.fn(),
      removeJobScheduler: jest.fn(),
    };
    jobsRegistryService = {
      createNewJob: jest.fn(),
    };
    toolsService = {
      getToolByNames: jest.fn(),
    };
    workflowsService = {
      workflowRepository: {
        findOne: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalNetworksService,
        {
          provide: getRepositoryToken(InternalNetwork),
          useValue: {
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
              getCount: jest.fn().mockResolvedValue(0),
            }),
          },
        },
        {
          provide: getRepositoryToken(NetworkInterface),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getRawMany: jest.fn(),
              getCount: jest.fn(),
            }),
            findByIds: jest.fn(),
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkerInstance),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            getWorkspaceByIdAndOwner: jest.fn(),
          },
        },
        {
          provide: TargetsService,
          useValue: {
            createMultipleTargets: jest.fn(),
          },
        },
        {
          provide: getQueueToken(
            BullMQName.INTERNAL_NETWORK_VULNERABILITY_SCAN_SCHEDULE,
          ),
          useValue: scheduleQueue,
        },
        {
          provide: JobsRegistryService,
          useValue: jobsRegistryService,
        },
        {
          provide: ToolsService,
          useValue: toolsService,
        },
        {
          provide: WorkflowsService,
          useValue: workflowsService,
        },
      ],
    }).compile();

    service = module.get<InternalNetworksService>(InternalNetworksService);
    internalNetworkRepo = module.get<Repository<InternalNetwork>>(
      getRepositoryToken(InternalNetwork),
    );
    networkInterfaceRepo = module.get<Repository<NetworkInterface>>(
      getRepositoryToken(NetworkInterface),
    );
    workerRepository = module.get<Repository<WorkerInstance>>(
      getRepositoryToken(WorkerInstance),
    );
    workspacesService = module.get<WorkspacesService>(WorkspacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduled vulnerability scans', () => {
    it('should schedule vulnerability scans for an internal network', async () => {
      const networkId = randomUUID();
      const user = { id: randomUUID() };
      const internalNetwork = {
        id: networkId,
        workspaceId: randomUUID(),
        vulnerabilityScanJobId: null,
      } as InternalNetwork;
      scheduleQueue.add.mockResolvedValue({ repeatJobKey: 'repeat-key' });
      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork);
      jest.spyOn(internalNetworkRepo, 'update').mockResolvedValue({} as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);

      const result = await service.updateVulnerabilityScanSchedule(
        networkId,
        { vulnerabilityScanSchedule: CronSchedule.DAILY },
        user as any,
      );

      expect(scheduleQueue.add).toHaveBeenCalledWith(
        networkId,
        { id: networkId },
        { repeat: { pattern: CronSchedule.DAILY } },
      );
      expect(internalNetworkRepo.update).toHaveBeenCalledWith(networkId, {
        vulnerabilityScanSchedule: CronSchedule.DAILY,
        vulnerabilityScanJobId: 'repeat-key',
      });
      expect(result).toEqual({
        message: 'Internal network vulnerability scan schedule updated successfully',
      });
    });

    it('should create scheduled vulnerability worker jobs for network targets', async () => {
      const networkId = randomUUID();
      const workspaceId = randomUUID();
      const targetIds = [randomUUID(), randomUUID()];
      const tool = { name: 'nuclei', priority: 2 };
      const workflow = { id: randomUUID(), workspace: { id: workspaceId } };
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue(targetIds.map((id) => ({ id }))),
      };

      jest.spyOn(internalNetworkRepo, 'findOne').mockResolvedValue({
        id: networkId,
        workspaceId,
      } as InternalNetwork);
      jest
        .spyOn(internalNetworkRepo, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);
      (toolsService.getToolByNames as jest.Mock).mockResolvedValue([tool]);
      (
        workflowsService.workflowRepository!.findOne as jest.Mock
      ).mockResolvedValue(workflow);

      const result = await service.runScheduledVulnerabilityScan(
        networkId,
        JobRunType.SCHEDULED,
      );

      expect(jobsRegistryService.createNewJob).toHaveBeenCalledWith({
        tool,
        targetIds,
        workflow,
        priority: tool.priority,
        workspaceId,
        jobName: 'Internal network vulnerability scan',
        jobRunType: JobRunType.SCHEDULED,
      });
      expect(result).toEqual({
        message: `Scheduled vulnerability scan started for ${targetIds.length} internal network targets`,
      });
    });
  });

  describe('createInternalNetwork', () => {
    it('should create internal network successfully', async () => {
      const dto: CreateInternalNetworkDto = {
        name: 'Test Network',
      };
      const workspaceId = randomUUID();
      const user = { id: randomUUID() };
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);
      jest.spyOn(internalNetworkRepo, 'save').mockResolvedValue({} as any);

      const result = await service.createInternalNetwork(
        dto,
        workspaceId,
        user as any,
      );

      expect(result).toEqual({
        message: 'Internal network created successfully',
      });
      expect(workspacesService.getWorkspaceByIdAndOwner).toHaveBeenCalledWith(
        workspaceId,
        user,
      );
    });

    it('should throw ForbiddenException if workspace not found or not owner', async () => {
      const dto: CreateInternalNetworkDto = {
        name: 'Test Network',
      };
      const workspaceId = randomUUID();
      const user = { id: randomUUID() };

      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockRejectedValue(
          new ForbiddenException('You are not the owner of this workspace'),
        );

      await expect(
        service.createInternalNetwork(dto, workspaceId, user as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      const dto: CreateInternalNetworkDto = {
        name: 'Test Network',
      };
      const workspaceId = randomUUID();
      const user = { id: randomUUID() };

      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockRejectedValue(
          new ForbiddenException('You are not the owner of this workspace'),
        );

      await expect(
        service.createInternalNetwork(dto, workspaceId, user as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateInternalNetworkById', () => {
    it('should update internal network successfully', async () => {
      const id = randomUUID();
      const dto: UpdateInternalNetworkDto = { name: 'Updated Network' };
      const user = { id: randomUUID() };
      const internalNetwork = {
        id,
        name: 'Old Name',
        workspace: { owner: { id: user.id } },
      };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);
      jest
        .spyOn(internalNetworkRepo, 'save')
        .mockResolvedValue(internalNetwork as any);

      const result = await service.updateInternalNetworkById(
        id,
        dto,
        user as any,
      );

      expect(result).toEqual({
        message: 'Internal network updated successfully',
      });
      expect(internalNetwork.name).toBe(dto.name);
    });

    it('should throw NotFoundException if internal network not found', async () => {
      const id = randomUUID();
      const dto: UpdateInternalNetworkDto = { name: 'Updated Network' };
      const user = { id: randomUUID() };

      jest.spyOn(internalNetworkRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateInternalNetworkById(id, dto, user as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      const id = randomUUID();
      const dto: UpdateInternalNetworkDto = { name: 'Updated Network' };
      const user = { id: randomUUID() };
      const internalNetwork = {
        id,
        workspaceId: randomUUID(),
        workspace: { owner: { id: randomUUID() } },
      };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockRejectedValue(
          new ForbiddenException('You are not the owner of this workspace'),
        );

      await expect(
        service.updateInternalNetworkById(id, dto, user as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteInternalNetwork', () => {
    it('should delete internal network successfully', async () => {
      const id = randomUUID();
      const user = { id: randomUUID() };
      const internalNetwork = {
        id,
        workspace: { owner: { id: user.id } },
      };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);
      jest
        .spyOn(internalNetworkRepo, 'remove')
        .mockResolvedValue(internalNetwork as any);

      const result = await service.deleteInternalNetwork(id, user as any);

      expect(result).toEqual({
        message: 'Internal network deleted successfully',
      });
    });

    it('should throw NotFoundException if internal network not found', async () => {
      const id = randomUUID();
      const user = { id: randomUUID() };

      jest.spyOn(internalNetworkRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.deleteInternalNetwork(id, user as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      const id = randomUUID();
      const user = { id: randomUUID() };
      const internalNetwork = {
        id,
        workspaceId: randomUUID(),
        workspace: { owner: { id: randomUUID() } },
      };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockRejectedValue(
          new ForbiddenException('You are not the owner of this workspace'),
        );

      await expect(
        service.deleteInternalNetwork(id, user as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getManyInternalNetworks', () => {
    it('should return paginated internal networks for workspace', async () => {
      const query: GetManyInternalNetworksQueryDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      };
      const workspaceId = randomUUID();
      const networks = [
        {
          id: randomUUID(),
          name: 'Network 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { id: randomUUID(), name: 'User 1', image: 'image1.jpg' },
          workers: [{ id: randomUUID() }],
        },
      ];
      const total = 1;

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: networks,
          raw: [{ agents: '1' }],
        }),
        getCount: jest.fn().mockResolvedValue(total),
      };
      jest
        .spyOn(internalNetworkRepo, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getManyInternalNetworks(query, workspaceId);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].agents).toBe(1);
      expect(result.total).toBe(total);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(internalNetworkRepo.createQueryBuilder).toHaveBeenCalledWith('network');
    });

    it('should filter by search on name when provided', async () => {
      const query: GetManyInternalNetworksQueryDto = {
        search: 'Test',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: SortOrder.ASC,
      };
      const workspaceId = randomUUID();

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
        getCount: jest.fn().mockResolvedValue(0),
      };
      jest
        .spyOn(internalNetworkRepo, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await service.getManyInternalNetworks(query, workspaceId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'network.name LIKE :search',
        { search: '%Test%' },
      );
    });
  });

  describe('getManyNetworkInterfaces', () => {
    it('should return paginated network interfaces for internal network', async () => {
      const internalNetworkId = randomUUID();
      const workspaceId = randomUUID();
      const query: GetManyNetworkInterfacesQueryDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
      };
      const internalNetwork = { id: internalNetworkId, workspaceId };
      const interfaces = [
        {
          id: randomUUID(),
          interfaceName: 'eth0',
          ipAddress: '192.168.1.10',
          cidr: '24',
          gatewayIp: '192.168.1.1',
          gatewayMac: 'aa:bb:cc:dd:ee:ff',
          workerId: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const total = 1;

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(interfaces),
        getCount: jest.fn().mockResolvedValue(total),
      };
      jest.spyOn(networkInterfaceRepo, 'createQueryBuilder').mockReturnValue(qb as any);

      const result = await service.getManyNetworkInterfaces(
        internalNetworkId,
        query,
        workspaceId,
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(total);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(internalNetworkRepo.findOne).toHaveBeenCalledWith({
        where: { id: internalNetworkId, workspaceId },
      });
    });

    it('should filter by search on interfaceName when provided', async () => {
      const internalNetworkId = randomUUID();
      const workspaceId = randomUUID();
      const query: GetManyNetworkInterfacesQueryDto = {
        search: 'eth',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: SortOrder.ASC,
      };
      const internalNetwork = { id: internalNetworkId, workspaceId };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      jest.spyOn(networkInterfaceRepo, 'createQueryBuilder').mockReturnValue(qb as any);

      await service.getManyNetworkInterfaces(
        internalNetworkId,
        query,
        workspaceId,
      );
    });

    it('should throw NotFoundException if internal network not found', async () => {
      const internalNetworkId = randomUUID();
      const workspaceId = randomUUID();
      const query: GetManyNetworkInterfacesQueryDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: SortOrder.ASC,
      };

      jest.spyOn(internalNetworkRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getManyNetworkInterfaces(internalNetworkId, query, workspaceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInternalNetworkById', () => {
    it('should return internal network when found', async () => {
      const id = randomUUID();
      const workspaceId = randomUUID();
      const network = {
        id,
        name: 'Test Network',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { id: randomUUID(), name: 'User', image: 'img.jpg' },
      };

      jest.spyOn(internalNetworkRepo, 'findOne').mockResolvedValue(network as any);

      const result = await service.getInternalNetworkById(id, workspaceId);

      expect(result).toEqual({
        id: network.id,
        name: network.name,
        createdAt: network.createdAt,
        updatedAt: network.updatedAt,
        agents: 0,
        createdBy: {
          id: network.creator.id,
          name: network.creator.name,
          image: network.creator.image,
        },
      });
      expect(internalNetworkRepo.findOne).toHaveBeenCalledWith({
        where: { id, workspaceId },
        relations: ['creator', 'workers'],
      });
    });

    it('should throw NotFoundException if internal network not found', async () => {
      const id = randomUUID();
      const workspaceId = randomUUID();

      jest.spyOn(internalNetworkRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getInternalNetworkById(id, workspaceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('network interface management', () => {
    it('should create a network interface successfully', async () => {
      const internalNetworkId = randomUUID();
      const workspaceId = randomUUID();
      const user = { id: randomUUID() };
      const dto = {
        interfaceName: 'eth1',
        ipAddress: '10.0.0.5',
        cidr: '24',
        gatewayIp: '10.0.0.1',
        gatewayMac: 'aa:bb:cc:dd:ee:ff',
        workerId: randomUUID(),
      };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue({ id: internalNetworkId, workspaceId } as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);
      jest
        .spyOn(workerRepository, 'findOne')
        .mockResolvedValue({ id: dto.workerId, workspaceId } as any);
      jest.spyOn(networkInterfaceRepo, 'save').mockResolvedValue({} as any);

      const result = await service.createNetworkInterface(
        internalNetworkId,
        dto as any,
        user as any,
      );

      expect(result).toEqual({
        message: 'Network interface created successfully',
      });
      expect(networkInterfaceRepo.save).toHaveBeenCalledWith({
        interfaceName: dto.interfaceName,
        ipAddress: dto.ipAddress,
        cidr: dto.cidr,
        gatewayIp: dto.gatewayIp,
        gatewayMac: dto.gatewayMac,
        workerId: dto.workerId,
        internalNetworkId,
      });
    });

    it('should update a network interface successfully', async () => {
      const internalNetworkId = randomUUID();
      const id = randomUUID();
      const user = { id: randomUUID() };
      const dto = { ipAddress: '10.0.0.25' };
      const internalNetwork = { id: internalNetworkId, workspaceId: randomUUID() };
      const networkInterface = {
        id,
        internalNetworkId,
        ipAddress: '10.0.0.5',
      };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);
      jest
        .spyOn(networkInterfaceRepo, 'findOne')
        .mockResolvedValue(networkInterface as any);
      jest.spyOn(networkInterfaceRepo, 'save').mockResolvedValue(networkInterface as any);

      const result = await service.updateNetworkInterfaceById(
        internalNetworkId,
        id,
        dto as any,
        user as any,
      );

      expect(result).toEqual({
        message: 'Network interface updated successfully',
      });
      expect(networkInterfaceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          internalNetworkId,
          ipAddress: dto.ipAddress,
        }),
      );
    });

    it('should delete a network interface successfully', async () => {
      const internalNetworkId = randomUUID();
      const id = randomUUID();
      const user = { id: randomUUID() };
      const internalNetwork = { id: internalNetworkId, workspaceId: randomUUID() };
      const networkInterface = { id, internalNetworkId };

      jest
        .spyOn(internalNetworkRepo, 'findOne')
        .mockResolvedValue(internalNetwork as any);
      jest
        .spyOn(workspacesService, 'getWorkspaceByIdAndOwner')
        .mockResolvedValue({} as any);
      jest
        .spyOn(networkInterfaceRepo, 'findOne')
        .mockResolvedValue(networkInterface as any);
      jest.spyOn(networkInterfaceRepo, 'remove').mockResolvedValue(networkInterface as any);

      const result = await service.deleteNetworkInterface(
        internalNetworkId,
        id,
        user as any,
      );

      expect(result).toEqual({
        message: 'Network interface deleted successfully',
      });
      expect(networkInterfaceRepo.remove).toHaveBeenCalledWith(networkInterface as any);
    });
  });
});
