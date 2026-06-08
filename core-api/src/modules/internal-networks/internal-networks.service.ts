import { DefaultMessageResponseDto } from '@/common/dtos/default-message-response.dto';
import {
  BullMQName,
  CronSchedule,
  JobRunType,
} from '@/common/enums/enum';
import { UserContextPayload } from '@/common/interfaces/app.interface';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { JobsRegistryService } from '../jobs-registry/jobs-registry.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TargetsService } from '../targets/targets.service';
import { ToolsService } from '../tools/tools.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { CreateInternalNetworkDto } from './dtos/create-internal-network.dto';
import { CreateNetworkInterfaceDto } from './dtos/create-network-interface.dto';
import { CreateTargetsFromInterfacesDto } from './dtos/create-targets-from-interfaces.dto';
import {
  GetInternalNetworkResponseDto,
  GetManyInternalNetworksQueryDto,
  GetManyInternalNetworksResponseDto,
} from './dtos/get-many-internal-networks.dto';
import { Target, TargetType } from '../targets/entities/target.entity';
import {
  GetManyNetworkInterfacesQueryDto,
  GetManyNetworkInterfacesResponseDto,
} from './dtos/get-many-network-interfaces.dto';
import { UpdateVulnerabilityScanScheduleDto } from './dtos/update-vulnerability-scan-schedule.dto';
import { UpdateInternalNetworkDto } from './dtos/update-internal-network.dto';
import { UpdateNetworkInterfaceDto } from './dtos/update-network-interface.dto';
import { InternalNetwork } from './entities/internal-network.entity';
import { NetworkInterface } from './entities/network-interface.entity';
import { WorkerInstance } from '../workers/entities/worker.entity';

@Injectable()
export class InternalNetworksService {
  constructor(
    @InjectRepository(InternalNetwork)
    private readonly internalNetworkRepository: Repository<InternalNetwork>,
    @InjectRepository(NetworkInterface)
    private readonly networkInterfaceRepository: Repository<NetworkInterface>,
    @InjectRepository(WorkerInstance)
    private readonly workerRepository: Repository<WorkerInstance>,
    private readonly workspacesService: WorkspacesService,
    private readonly targetsService: TargetsService,
    @InjectQueue(BullMQName.INTERNAL_NETWORK_VULNERABILITY_SCAN_SCHEDULE)
    private readonly vulnerabilityScanScheduleQueue: Queue<InternalNetwork>,
    private readonly jobsRegistryService: JobsRegistryService,
    private readonly toolsService: ToolsService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  async getManyInternalNetworks(
    query: GetManyInternalNetworksQueryDto,
    workspaceId: string,
  ): Promise<GetManyInternalNetworksResponseDto> {
    const { page, limit, sortBy, sortOrder, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.internalNetworkRepository
      .createQueryBuilder('network')
      .leftJoinAndSelect('network.creator', 'creator')
      .addSelect(
        (subQuery) => {
          return subQuery
            .select('COUNT(worker.id)', 'agentCount')
            .from(WorkerInstance, 'worker')
            .where('worker.internalNetworkId = network.id');
        },
        'agents',
      )
      .where('network.workspaceId = :workspaceId', { workspaceId });

    if (search) {
      queryBuilder.andWhere('network.name LIKE :search', {
        search: `%${search}%`,
      });
    }

    queryBuilder.orderBy(`network.${sortBy}`, sortOrder).skip(skip).take(limit);

    const { entities, raw } = await queryBuilder.getRawAndEntities();
    const total = await queryBuilder.getCount();

    const data = entities.map((network, index) => {
      const rawData = raw[index] as { agents: string | number };
      return {
        id: network.id,
        name: network.name,
        createdAt: network.createdAt,
        updatedAt: network.updatedAt,
        agents: parseInt(String(rawData.agents), 10) || 0,
        vulnerabilityScanSchedule: network.vulnerabilityScanSchedule,
        vulnerabilityScanJobId: network.vulnerabilityScanJobId,
        createdBy: {
          id: network.creator?.id || '',
          name: network.creator?.name || '',
          image: network.creator?.image || '',
        },
      };
    });

    const pageCount = Math.ceil(total / limit);
    const hasNextPage = page * limit < total;

    return {
      data,
      total,
      page,
      limit,
      hasNextPage,
      pageCount,
    };
  }

  async createInternalNetwork(
    dto: CreateInternalNetworkDto,
    workspaceId: string,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    // Check if workspace exists and user is owner
    await this.workspacesService.getWorkspaceByIdAndOwner(workspaceId, user);

    // Create internal network

    await this.internalNetworkRepository.save({
      name: dto.name,
      workspaceId,
      createdBy: user.id,
    });

    return { message: 'Internal network created successfully' };
  }

  async updateInternalNetworkById(
    id: string,
    dto: UpdateInternalNetworkDto,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    // Find internal network with workspace

    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id },
      relations: ['workspace'],
    });
    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }
    // Check workspace ownership

    await this.workspacesService.getWorkspaceByIdAndOwner(
      internalNetwork.workspaceId,
      user,
    );

    // Update name if provided
    if (dto.name !== undefined) {
      internalNetwork.name = dto.name;

      await this.internalNetworkRepository.save(internalNetwork);
    }

    return { message: 'Internal network updated successfully' };
  }

  async deleteInternalNetwork(
    id: string,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    // Find internal network with workspace

    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id },
      relations: ['workspace'],
    });
    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }
    // Check workspace ownership

    await this.workspacesService.getWorkspaceByIdAndOwner(
      internalNetwork.workspaceId,
      user,
    );

    // Delete
    await this.internalNetworkRepository.remove(internalNetwork);

    return { message: 'Internal network deleted successfully' };
  }

  async getManyNetworkInterfaces(
    internalNetworkId: string,
    query: GetManyNetworkInterfacesQueryDto,
    workspaceId: string,
  ): Promise<GetManyNetworkInterfacesResponseDto> {
    // Verify internal network exists and belongs to workspace
    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id: internalNetworkId, workspaceId },
    });
    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }

    const { page, limit, sortBy, sortOrder, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.networkInterfaceRepository
      .createQueryBuilder('iface')
      .leftJoin(
        Target,
        'target',
        'target.value = iface.cidr AND target.internalNetworkId = :internalNetworkId',
        {
          internalNetworkId,
        },
      )
      .where('iface.internalNetworkId = :internalNetworkId', {
        internalNetworkId,
      })
      .select('iface.id', 'id')
      .addSelect('iface.interfaceName', 'interfaceName')
      .addSelect('iface.ipAddress', 'ipAddress')
      .addSelect('iface.cidr', 'cidr')
      .addSelect('iface.gatewayIp', 'gatewayIp')
      .addSelect('iface.gatewayMac', 'gatewayMac')
      .addSelect('iface.workerId', 'workerId')
      .addSelect('iface.createdAt', 'createdAt')
      .addSelect('iface.updatedAt', 'updatedAt')
      .addSelect('target.id', 'targetId');

    if (search) {
      queryBuilder.andWhere('iface.interfaceName LIKE :search', {
        search: `%${search}%`,
      });
    }

    queryBuilder.orderBy(`iface.${sortBy}`, sortOrder);
    queryBuilder.skip(skip).take(limit);

    const [rawResults, total] = await Promise.all([
      queryBuilder.getRawMany(),
      queryBuilder.getCount(),
    ]);

    interface RawNetworkInterface {
      id: string;
      interfaceName: string;
      ipAddress: string;
      cidr: string;
      gatewayIp: string;
      gatewayMac: string;
      workerId: string | null;
      createdAt: Date;
      updatedAt: Date;
      targetId: string | null;
    }

    const data = (rawResults as RawNetworkInterface[]).map((row) => ({
      id: row.id,
      interfaceName: row.interfaceName,
      ipAddress: row.ipAddress,
      cidr: row.cidr,
      gatewayIp: row.gatewayIp,
      gatewayMac: row.gatewayMac,
      workerId: row.workerId || null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      targetId: row.targetId || null,
    }));

    const pageCount = Math.ceil(total / limit);
    const hasNextPage = page * limit < total;

    return {
      data,
      total,
      page,
      limit,
      hasNextPage,
      pageCount,
    };
  }

  async getInternalNetworkById(
    id: string,
    workspaceId: string,
  ): Promise<GetInternalNetworkResponseDto> {
    const network = await this.internalNetworkRepository.findOne({
      where: { id, workspaceId },
      relations: ['creator', 'workers'],
    });
    if (!network) {
      throw new NotFoundException('Internal network not found');
    }

    return {
      id: network.id,
      name: network.name,
      createdAt: network.createdAt,
      updatedAt: network.updatedAt,
      agents: network.workers?.length || 0,
      vulnerabilityScanSchedule: network.vulnerabilityScanSchedule,
      vulnerabilityScanJobId: network.vulnerabilityScanJobId,
      createdBy: {
        id: network.creator?.id || '',
        name: network.creator?.name || '',
        image: network.creator?.image || '',
      },
    };
  }

  async createNetworkInterface(
    internalNetworkId: string,
    dto: CreateNetworkInterfaceDto,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id: internalNetworkId },
    });

    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }

    await this.workspacesService.getWorkspaceByIdAndOwner(
      internalNetwork.workspaceId,
      user,
    );

    if (dto.workerId) {
      const worker = await this.workerRepository.findOne({
        where: {
          id: dto.workerId,
          workspaceId: internalNetwork.workspaceId,
        },
      });

      if (!worker) {
        throw new NotFoundException('Worker not found');
      }
    }

    await this.networkInterfaceRepository.save({
      interfaceName: dto.interfaceName,
      ipAddress: dto.ipAddress,
      cidr: dto.cidr,
      gatewayIp: dto.gatewayIp ?? '',
      gatewayMac: dto.gatewayMac ?? '',
      workerId: dto.workerId ?? null,
      internalNetworkId,
    });

    return { message: 'Network interface created successfully' };
  }

  async updateVulnerabilityScanSchedule(
    id: string,
    dto: UpdateVulnerabilityScanScheduleDto,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id },
    });

    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }

    await this.workspacesService.getWorkspaceByIdAndOwner(
      internalNetwork.workspaceId,
      user,
    );

    const job = await this.updateVulnerabilityScanScheduleJob(
      internalNetwork,
      dto.vulnerabilityScanSchedule,
    );

    await this.internalNetworkRepository.update(id, {
      vulnerabilityScanSchedule: dto.vulnerabilityScanSchedule,
      vulnerabilityScanJobId: job?.repeatJobKey ?? null,
    });

    return {
      message:
        'Internal network vulnerability scan schedule updated successfully',
    };
  }

  async runScheduledVulnerabilityScan(
    internalNetworkId: string,
    jobRunType: JobRunType = JobRunType.SCHEDULED,
  ): Promise<DefaultMessageResponseDto> {
    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id: internalNetworkId },
    });

    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }

    const targetRows = await this.internalNetworkRepository
      .createQueryBuilder('network')
      .innerJoin('network.targets', 'target')
      .select('target.id', 'id')
      .where('network.id = :internalNetworkId', { internalNetworkId })
      .getRawMany<{ id: string }>();
    const targetIds = targetRows.map((row) => row.id);

    if (targetIds.length === 0) {
      throw new BadRequestException(
        'Internal network does not have targets to scan. Create targets from network interfaces first.',
      );
    }

    const tools = await this.toolsService.getToolByNames({
      names: ['nuclei'],
      isInstalled: true,
    });

    if (!tools.length) {
      throw new BadRequestException(
        'Nuclei vulnerability scanner is not installed or available.',
      );
    }

    const workflow = await this.workflowsService.workflowRepository.findOne({
      where: {
        workspace: {
          id: internalNetwork.workspaceId,
        },
        filePath: 'vulnerability_scan_basic.yaml',
      },
      relations: ['workspace'],
    });

    if (!workflow) {
      throw new NotFoundException(
        'Vulnerability scanning workflow not found in the workspace.',
      );
    }

    const tool = tools[0];
    await this.jobsRegistryService.createNewJob({
      tool,
      targetIds,
      workflow,
      priority: tool.priority,
      workspaceId: internalNetwork.workspaceId,
      jobName: 'Internal network vulnerability scan',
      jobRunType,
    });

    return {
      message: `Scheduled vulnerability scan started for ${targetIds.length} internal network targets`,
    };
  }

  private async updateVulnerabilityScanScheduleJob(
    internalNetwork: InternalNetwork,
    vulnerabilityScanSchedule: CronSchedule,
  ): Promise<Job<InternalNetwork> | null> {
    if (internalNetwork.vulnerabilityScanJobId) {
      await this.vulnerabilityScanScheduleQueue.removeJobScheduler(
        internalNetwork.vulnerabilityScanJobId,
      );
    }

    if (vulnerabilityScanSchedule === CronSchedule.DISABLED) {
      return null;
    }

    return this.vulnerabilityScanScheduleQueue.add(
      internalNetwork.id,
      { id: internalNetwork.id } as InternalNetwork,
      {
        repeat: {
          pattern: vulnerabilityScanSchedule,
        },
      },
    );
  }

  async updateNetworkInterfaceById(
    internalNetworkId: string,
    id: string,
    dto: UpdateNetworkInterfaceDto,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id: internalNetworkId },
    });

    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }

    await this.workspacesService.getWorkspaceByIdAndOwner(
      internalNetwork.workspaceId,
      user,
    );

    const networkInterface = await this.networkInterfaceRepository.findOne({
      where: {
        id,
        internalNetworkId,
      },
    });

    if (!networkInterface) {
      throw new NotFoundException('Network interface not found');
    }

    if (dto.workerId) {
      const worker = await this.workerRepository.findOne({
        where: {
          id: dto.workerId,
          workspaceId: internalNetwork.workspaceId,
        },
      });

      if (!worker) {
        throw new NotFoundException('Worker not found');
      }
    }

    Object.assign(networkInterface, dto);
    await this.networkInterfaceRepository.save(networkInterface);

    return { message: 'Network interface updated successfully' };
  }

  async deleteNetworkInterface(
    internalNetworkId: string,
    id: string,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    const internalNetwork = await this.internalNetworkRepository.findOne({
      where: { id: internalNetworkId },
    });

    if (!internalNetwork) {
      throw new NotFoundException('Internal network not found');
    }

    await this.workspacesService.getWorkspaceByIdAndOwner(
      internalNetwork.workspaceId,
      user,
    );

    const networkInterface = await this.networkInterfaceRepository.findOne({
      where: {
        id,
        internalNetworkId,
      },
    });

    if (!networkInterface) {
      throw new NotFoundException('Network interface not found');
    }

    await this.networkInterfaceRepository.remove(networkInterface);

    return { message: 'Network interface deleted successfully' };
  }

  async createTargetsFromInterfaces(
    dto: CreateTargetsFromInterfacesDto,
    user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    const interfaces = await this.networkInterfaceRepository.findByIds(
      dto.networkInterfaceIds,
    );

    if (!interfaces.length) {
      throw new NotFoundException(
        'No network interfaces found for the provided IDs',
      );
    }

    const internalNetworkIds = Array.from(
      new Set(interfaces.map((iface) => iface.internalNetworkId)),
    );
    const internalNetworks = await this.internalNetworkRepository.findByIds(
      internalNetworkIds,
    );

    const networkById = new Map(
      internalNetworks.map((network) => [network.id, network]),
    );

    const grouped = new Map<string, Map<string, string[]>>();

    for (const iface of interfaces) {
      const network = networkById.get(iface.internalNetworkId);
      if (!network) {
        continue;
      }

      const workspaceId = network.workspaceId;
      const internalNetworkId = iface.internalNetworkId;

      if (!grouped.has(workspaceId)) {
        grouped.set(workspaceId, new Map());
      }

      const networksInWorkspace = grouped.get(workspaceId)!;

      if (!networksInWorkspace.has(internalNetworkId)) {
        networksInWorkspace.set(internalNetworkId, []);
      }

      networksInWorkspace.get(internalNetworkId)!.push(iface.cidr);
    }

    for (const [workspaceId, networksInWorkspace] of grouped) {
      for (const [internalNetworkId, cidrs] of networksInWorkspace) {
        await this.targetsService.createMultipleTargets(
          {
            targets: cidrs.map((cidr) => ({
              value: cidr,
              type: TargetType.CIDR,
            })),
          },
          workspaceId,
          user,
          internalNetworkId,
        );
      }
    }

    return { message: 'Targets created successfully from network interfaces' };
  }
}
