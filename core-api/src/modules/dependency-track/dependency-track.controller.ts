import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckSbomDto } from './dtos/check-sbom.dto';
import { DependencyTrackCheckResponseDto } from './dtos/dependency-track-check-response.dto';
import { DependencyTrackDashboardDto } from './dtos/dependency-track-dashboard.dto';
import { DependencyTrackStatusDto } from './dtos/dependency-track-status.dto';
import { DependencyTrackService } from './dependency-track.service';

@ApiTags('Dependency Track')
@Controller('dependency-track')
export class DependencyTrackController {
  constructor(private readonly dependencyTrackService: DependencyTrackService) {}

  @Get('status')
  async getStatus(): Promise<DependencyTrackStatusDto> {
    await this.dependencyTrackService.testConnection();
    return {
      status: 'ok',
      message: 'Dependency Track connection established successfully',
    };
  }

  @Get('dashboard')
  async getDashboard(): Promise<DependencyTrackDashboardDto> {
    return this.dependencyTrackService.getDashboardSummary();
  }

  @Post('dashboard/sync')
  async syncDashboard(): Promise<DependencyTrackDashboardDto> {
    return this.dependencyTrackService.syncDashboardVulnerabilities();
  }

  @Post('sbom')
  async checkSbom(
    @Body() dto: CheckSbomDto,
  ): Promise<DependencyTrackCheckResponseDto> {
    return this.dependencyTrackService.checkSbomVulnerabilities(dto.sbomUrl);
  }
}
