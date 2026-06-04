import { ApiProperty } from '@nestjs/swagger';
import { DependencyTrackVulnerabilityDto } from './dependency-track-vulnerability.dto';

export class DependencyTrackCheckResponseDto {
  @ApiProperty({ description: 'Dependency Track project UUID if available', required: false })
  projectUuid?: string;

  @ApiProperty({ description: 'Human-readable message describing the result', example: 'SBOM scan completed successfully' })
  message: string;

  @ApiProperty({ type: [DependencyTrackVulnerabilityDto], example: [] })
  vulnerabilities: DependencyTrackVulnerabilityDto[];
}
