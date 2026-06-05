import { BullMQName } from '@/common/enums/enum';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsRegistryModule } from '../jobs-registry/jobs-registry.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { InternalNetwork } from './entities/internal-network.entity';
import { NetworkInterface } from './entities/network-interface.entity';
import { WorkerInstance } from '../workers/entities/worker.entity';
import { InternalNetworksController } from './internal-networks.controller';
import { InternalNetworksService } from './internal-networks.service';
import { InternalNetworkVulnerabilityScheduleProcessor } from './processors/internal-network-vulnerability-schedule.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([InternalNetwork, NetworkInterface, WorkerInstance]),
    WorkspacesModule,
    JobsRegistryModule,
    ToolsModule,
    WorkflowsModule,
    BullModule.registerQueue({
      name: BullMQName.INTERNAL_NETWORK_VULNERABILITY_SCAN_SCHEDULE,
    }),
  ],
  controllers: [InternalNetworksController],
  providers: [
    InternalNetworksService,
    InternalNetworkVulnerabilityScheduleProcessor,
  ],
  exports: [InternalNetworksService],
})
export class InternalNetworksModule {}
