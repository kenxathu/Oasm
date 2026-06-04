import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DependencyTrackController } from './dependency-track.controller';
import { DependencyTrackService } from './dependency-track.service';

@Module({
  imports: [HttpModule],
  controllers: [DependencyTrackController],
  providers: [DependencyTrackService],
})
export class DependencyTrackModule {}
