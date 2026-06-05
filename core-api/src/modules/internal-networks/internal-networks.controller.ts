import { UserContext } from '@/common/decorators/app.decorator';
import { WorkspaceId } from '@/common/decorators/workspace-id.decorator';
import { Doc } from '@/common/doc/doc.decorator';
import { DefaultMessageResponseDto } from '@/common/dtos/default-message-response.dto';
import { WorkspaceOwnerGuard } from '@/common/guards/workspace-owner.guard';
import { UserContextPayload } from '@/common/interfaces/app.interface';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateInternalNetworkDto } from './dtos/create-internal-network.dto';
import { CreateNetworkInterfaceDto } from './dtos/create-network-interface.dto';
import { CreateTargetsFromInterfacesDto } from './dtos/create-targets-from-interfaces.dto';
import {
  GetInternalNetworkResponseDto,
  GetManyInternalNetworksQueryDto,
  GetManyInternalNetworksResponseDto,
} from './dtos/get-many-internal-networks.dto';
import {
  GetManyNetworkInterfacesQueryDto,
  GetManyNetworkInterfacesResponseDto,
} from './dtos/get-many-network-interfaces.dto';
import { UpdateInternalNetworkDto } from './dtos/update-internal-network.dto';
import { UpdateNetworkInterfaceDto } from './dtos/update-network-interface.dto';
import { UpdateVulnerabilityScanScheduleDto } from './dtos/update-vulnerability-scan-schedule.dto';
import { InternalNetworksService } from './internal-networks.service';

@Controller('internal-networks')
export class InternalNetworksController {
  constructor(
    private readonly internalNetworksService: InternalNetworksService,
  ) {}

  @Doc({
    summary: 'Get many internal networks',
    description:
      'Retrieves a paginated list of internal networks for the specified workspace.',
    response: {
      serialization: GetManyInternalNetworksResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Get()
  getManyInternalNetworks(
    @Query() query: GetManyInternalNetworksQueryDto,
    @WorkspaceId() workspaceId: string,
  ): Promise<GetManyInternalNetworksResponseDto> {
    return this.internalNetworksService.getManyInternalNetworks(
      query,
      workspaceId,
    );
  }

  @Doc({
    summary: 'Create an internal network',
    description:
      'Creates a new internal network for the specified workspace. Only the workspace owner can perform this action.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Post()
  @UseGuards(WorkspaceOwnerGuard)
  createInternalNetwork(
    @Body() dto: CreateInternalNetworkDto,
    @WorkspaceId() workspaceId: string,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.createInternalNetwork(
      dto,
      workspaceId,
      user,
    );
  }

  @Doc({
    summary: 'Create targets from network interfaces',
    description:
      'Creates new targets from the CIDRs of the specified network interfaces.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Post('targets')
  @UseGuards(WorkspaceOwnerGuard)
  createTargetsFromInterfaces(
    @Body() dto: CreateTargetsFromInterfacesDto,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.createTargetsFromInterfaces(dto, user);
  }

  @Doc({
    summary: 'Update internal network vulnerability scan schedule',
    description:
      'Schedules worker-based vulnerability scans for targets belonging to an internal network.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Patch(':id/vulnerability-schedule')
  @UseGuards(WorkspaceOwnerGuard)
  updateVulnerabilityScanSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVulnerabilityScanScheduleDto,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.updateVulnerabilityScanSchedule(
      id,
      dto,
      user,
    );
  }

  @Doc({
    summary: 'Get many network interfaces for an internal network',
    description:
      'Retrieves a paginated list of network interfaces for the specified internal network.',
    response: {
      serialization: GetManyNetworkInterfacesResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Get(':id/network-interfaces')
  getManyNetworkInterfaces(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetManyNetworkInterfacesQueryDto,
    @WorkspaceId() workspaceId: string,
  ): Promise<GetManyNetworkInterfacesResponseDto> {
    return this.internalNetworksService.getManyNetworkInterfaces(id, query, workspaceId);
  }

  @Doc({
    summary: 'Create a network interface',
    description:
      'Adds a new network interface under the specified internal network.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Post(':id/network-interfaces')
  @UseGuards(WorkspaceOwnerGuard)
  createNetworkInterface(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNetworkInterfaceDto,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.createNetworkInterface(id, dto, user);
  }

  @Doc({
    summary: 'Update a network interface',
    description:
      'Updates an existing network interface under the specified internal network.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Patch(':networkId/network-interfaces/:id')
  @UseGuards(WorkspaceOwnerGuard)
  updateNetworkInterfaceById(
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNetworkInterfaceDto,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.updateNetworkInterfaceById(
      networkId,
      id,
      dto,
      user,
    );
  }

  @Doc({
    summary: 'Delete a network interface',
    description:
      'Removes a network interface from the specified internal network.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Delete(':networkId/network-interfaces/:id')
  @UseGuards(WorkspaceOwnerGuard)
  deleteNetworkInterface(
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.deleteNetworkInterface(
      networkId,
      id,
      user,
    );
  }

  @Doc({
    summary: 'Get an internal network by ID',
    description: 'Retrieves a single internal network by its ID.',
    response: {
      serialization: GetInternalNetworkResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Get(':id')
  getInternalNetworkById(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<GetInternalNetworkResponseDto> {
    return this.internalNetworksService.getInternalNetworkById(id, workspaceId);
  }

  @Doc({
    summary: 'Update an internal network by ID',
    description:
      'Updates the name of an existing internal network. Only the workspace owner can perform this action.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Patch(':id')
  @UseGuards(WorkspaceOwnerGuard)
  updateInternalNetworkById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInternalNetworkDto,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.updateInternalNetworkById(
      id,
      dto,
      user,
    );
  }

  @Doc({
    summary: 'Delete an internal network',
    description:
      'Deletes an existing internal network. Only the workspace owner can perform this action.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
    request: {
      getWorkspaceId: true,
    },
  })
  @Delete(':id')
  @UseGuards(WorkspaceOwnerGuard)
  deleteInternalNetwork(
    @Param('id', ParseUUIDPipe) id: string,
    @UserContext() user: UserContextPayload,
  ): Promise<DefaultMessageResponseDto> {
    return this.internalNetworksService.deleteInternalNetwork(id, user);
  }
}
