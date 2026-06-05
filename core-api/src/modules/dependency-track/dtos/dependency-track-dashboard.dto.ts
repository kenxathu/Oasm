import { ApiProperty } from '@nestjs/swagger';
import { DependencyTrackVulnerabilityDto } from './dependency-track-vulnerability.dto';

export class DependencyTrackSeveritySummaryDto {
  @ApiProperty({ example: 0 })
  critical: number;

  @ApiProperty({ example: 0 })
  high: number;

  @ApiProperty({ example: 0 })
  medium: number;

  @ApiProperty({ example: 0 })
  low: number;

  @ApiProperty({ example: 0 })
  info: number;

  @ApiProperty({ example: 0 })
  unknown: number;
}

export class DependencyTrackProjectSummaryDto {
  @ApiProperty({ description: 'Dependency-Track project UUID.' })
  uuid: string;

  @ApiProperty({ description: 'Dependency-Track project name.' })
  name: string;

  @ApiProperty({
    description: 'Dependency-Track project version.',
    required: false,
  })
  version?: string;

  @ApiProperty({ description: 'Number of findings for this project.' })
  findings: number;
}

export class DependencyTrackDashboardDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({
    example: 'Dependency-Track vulnerabilities synchronized successfully.',
  })
  message: string;

  @ApiProperty({ description: 'Cron expression used by the sync job.' })
  syncCron: string;

  @ApiProperty({
    description: 'Last successful synchronization timestamp.',
    required: false,
  })
  lastSyncedAt?: string;

  @ApiProperty({
    description: 'Last synchronization error message.',
    required: false,
  })
  lastError?: string;

  @ApiProperty({ type: DependencyTrackSeveritySummaryDto })
  severity: DependencyTrackSeveritySummaryDto;

  @ApiProperty({ description: 'Total synchronized findings.' })
  total: number;

  @ApiProperty({ type: [DependencyTrackProjectSummaryDto] })
  projects: DependencyTrackProjectSummaryDto[];

  @ApiProperty({ type: [DependencyTrackVulnerabilityDto] })
  vulnerabilities: DependencyTrackVulnerabilityDto[];
}
