import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DependencyTrackController } from './dependency-track.controller';
import { DependencyTrackService } from './dependency-track.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot()],
  controllers: [DependencyTrackController],
  providers: [DependencyTrackService],
})
export class DependencyTrackModule {}
