import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
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
  getDashboard(): DependencyTrackDashboardDto {
    return this.dependencyTrackService.getDashboardSummary();
  }

  @Post('dashboard/sync')
  syncDashboard(): Promise<DependencyTrackDashboardDto> {
    return this.dependencyTrackService.syncDashboardVulnerabilities();
  }

  @Post('sbom')
  checkSbom(
    @Body() dto: CheckSbomDto,
  ): Promise<DependencyTrackCheckResponseDto> {
    return this.dependencyTrackService.checkSbomVulnerabilities(dto.sbomUrl);
  }

  @Post('sbom/file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'A JSON SBOM file such as sbom.json.',
        },
      },
      required: ['file'],
    },
  })
  checkSbomFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DependencyTrackCheckResponseDto> {
    return this.dependencyTrackService.checkSbomFileVulnerabilities(file);
  }
}
