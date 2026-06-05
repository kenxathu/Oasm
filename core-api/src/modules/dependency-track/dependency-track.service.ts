import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AxiosResponse } from 'axios';
import { Buffer } from 'buffer';
import { CronJob } from 'cron';
import { firstValueFrom } from 'rxjs';
import { DependencyTrackCheckResponseDto } from './dtos/dependency-track-check-response.dto';
import {
  DependencyTrackDashboardDto,
  DependencyTrackProjectSummaryDto,
  DependencyTrackSeveritySummaryDto,
} from './dtos/dependency-track-dashboard.dto';
import { DependencyTrackVulnerabilityDto } from './dtos/dependency-track-vulnerability.dto';

@Injectable()
export class DependencyTrackService implements OnModuleInit {
  private static readonly DEFAULT_SYNC_CRON = '0 */30 * * * *';
  private static readonly DASHBOARD_VULNERABILITY_LIMIT = 20;
  private readonly logger = new Logger(DependencyTrackService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly syncCron: string;
  private readonly projectUuid?: string;
  private readonly projectName?: string;
  private readonly projectVersion?: string;
  private dashboardCache: DependencyTrackDashboardDto;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.baseUrl =
      this.configService.get<string>('DEPENDENCY_TRACK_BASE_URL') || '';
    this.apiKey = this.configService.get<string>('DEPENDENCY_TRACK_API_KEY');
    this.username = this.configService.get<string>('DEPENDENCY_TRACK_USERNAME');
    this.password = this.configService.get<string>('DEPENDENCY_TRACK_PASSWORD');
    this.syncCron =
      this.configService.get<string>('DEPENDENCY_TRACK_SYNC_CRON') ||
      DependencyTrackService.DEFAULT_SYNC_CRON;
    this.projectUuid = this.configService.get<string>(
      'DEPENDENCY_TRACK_PROJECT_UUID',
    );
    this.projectName = this.configService.get<string>(
      'DEPENDENCY_TRACK_PROJECT_NAME',
    );
    this.projectVersion = this.configService.get<string>(
      'DEPENDENCY_TRACK_PROJECT_VERSION',
    );
    this.dashboardCache = this.createEmptyDashboard(
      'Dependency-Track dashboard sync has not run yet.',
    );

    if (!this.baseUrl) {
      throw new Error('DEPENDENCY_TRACK_BASE_URL is not configured');
    }

    if (!this.apiKey && !(this.username && this.password)) {
      throw new Error(
        'Dependency Track authentication is not configured. Set DEPENDENCY_TRACK_API_KEY or DEPENDENCY_TRACK_USERNAME and DEPENDENCY_TRACK_PASSWORD.',
      );
    }

    this.httpService.axiosRef.defaults.baseURL = this.baseUrl;
    this.httpService.axiosRef.defaults.headers.common.Accept =
      'application/json';

    if (this.apiKey) {
      this.httpService.axiosRef.defaults.headers.common['X-Api-Key'] =
        this.apiKey;
    } else {
      const token = Buffer.from(
        `${this.username}:${this.password}`,
        'utf-8',
      ).toString('base64');
      this.httpService.axiosRef.defaults.headers.common.Authorization =
        `Basic ${token}`;
    }

    void this.testConnection();
  }

  onModuleInit(): void {
    const job = CronJob.from({
      cronTime: this.syncCron,
      onTick: () => {
        void this.syncDashboardVulnerabilities();
      },
      start: true,
    });

    this.schedulerRegistry.addCronJob('dependency-track-dashboard-sync', job);
    void this.syncDashboardVulnerabilities();
  }

  async testConnection(): Promise<void> {
    try {
      await firstValueFrom(this.httpService.get('/api/v1/system/health'));
      this.logger.log('Dependency Track connection established successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Dependency Track connection failed: ${message}`,
        error as Error,
      );
      throw new Error(`Dependency Track connection failed: ${message}`);
    }
  }

  async checkSbomVulnerabilities(
    sbomUrl: string,
  ): Promise<DependencyTrackCheckResponseDto> {
    try {
      const sbomResponse: AxiosResponse<string> = await firstValueFrom(
        this.httpService.get<string>(sbomUrl, {
          responseType: 'text',
        }),
      );

      const contentType =
        sbomResponse.headers['content-type'] || 'application/json';
      const isJson =
        String(contentType).includes('json') || sbomUrl.endsWith('.json');

      const uploadResponse: AxiosResponse<DependencyTrackUploadResponse> =
        await firstValueFrom(
          this.httpService.post(
            '/api/v1/bom?autoCreate=true',
            sbomResponse.data,
            {
              headers: {
                'Content-Type': isJson
                  ? 'application/json'
                  : 'application/xml',
              },
            },
          ),
        );

      const projectUuid =
        uploadResponse.data?.project?.uuid || uploadResponse.data?.project?.id;
      const rawVulnerabilities =
        uploadResponse.data?.vulnerabilities ||
        uploadResponse.data?.findings ||
        [];

      const vulnerabilities = this.mapVulnerabilities(rawVulnerabilities);

      return {
        projectUuid,
        message: 'SBOM imported successfully into Dependency Track.',
        vulnerabilities,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Dependency Track SBOM scan failed: ${message}`,
        error as Error,
      );
      throw new BadRequestException(
        `Failed to scan SBOM with Dependency Track: ${message}`,
      );
    }
  }

  getDashboardSummary(): DependencyTrackDashboardDto {
    return this.dashboardCache;
  }

  async syncDashboardVulnerabilities(): Promise<DependencyTrackDashboardDto> {
    try {
      const projects = await this.resolveProjects();
      const projectResults = await Promise.all(
        projects.map((project) => this.getProjectFindings(project)),
      );
      const vulnerabilities = projectResults.flatMap(
        (result) => result.vulnerabilities,
      );
      const projectSummaries = projectResults.map((result) => result.project);

      this.dashboardCache = {
        status: 'ok',
        message: 'Dependency-Track vulnerabilities synchronized successfully.',
        syncCron: this.syncCron,
        lastSyncedAt: new Date().toISOString(),
        severity: this.createSeveritySummary(vulnerabilities),
        total: vulnerabilities.length,
        projects: projectSummaries,
        vulnerabilities: vulnerabilities
          .sort(
            (a, b) =>
              this.getSeverityRank(a.severity) -
              this.getSeverityRank(b.severity),
          )
          .slice(0, DependencyTrackService.DASHBOARD_VULNERABILITY_LIMIT),
      };

      return this.dashboardCache;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Dependency-Track dashboard sync failed: ${message}`,
        error as Error,
      );
      this.dashboardCache = {
        ...this.dashboardCache,
        status: 'error',
        message: 'Dependency-Track dashboard sync failed.',
        syncCron: this.syncCron,
        lastError: message,
      };
      return this.dashboardCache;
    }
  }

  private async resolveProjects(): Promise<DependencyTrackProject[]> {
    if (this.projectUuid) {
      const response = await firstValueFrom(
        this.httpService.get<DependencyTrackProject>(
          `/api/v1/project/${this.projectUuid}`,
        ),
      );
      return [response.data];
    }

    if (this.projectName) {
      const response = await firstValueFrom(
        this.httpService.get<DependencyTrackProject>('/api/v1/project/lookup', {
          params: {
            name: this.projectName,
            version: this.projectVersion,
          },
        }),
      );
      return [response.data];
    }

    const response = await firstValueFrom(
      this.httpService.get<DependencyTrackProject[]>('/api/v1/project', {
        params: {
          excludeInactive: true,
          onlyRoot: false,
        },
      }),
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  private async getProjectFindings(
    project: DependencyTrackProject,
  ): Promise<{
    project: DependencyTrackProjectSummaryDto;
    vulnerabilities: DependencyTrackVulnerabilityDto[];
  }> {
    const rawFindings = await this.fetchProjectFindings(project.uuid);
    const vulnerabilities = this.mapVulnerabilities(rawFindings).map(
      (vulnerability) => ({
        ...vulnerability,
        source: project.name
          ? `Dependency Track: ${project.name}`
          : 'Dependency Track',
      }),
    );

    return {
      project: {
        uuid: project.uuid,
        name: project.name || 'Unknown project',
        version: project.version,
        findings: vulnerabilities.length,
      },
      vulnerabilities,
    };
  }

  private async fetchProjectFindings(projectUuid: string): Promise<unknown[]> {
    try {
      const exportResponse = await firstValueFrom(
        this.httpService.get<DependencyTrackFindingExport>(
          `/api/v1/finding/project/${projectUuid}/export`,
        ),
      );
      return Array.isArray(exportResponse.data?.findings)
        ? exportResponse.data.findings
        : [];
    } catch {
      const response = await firstValueFrom(
        this.httpService.get<unknown[]>(
          `/api/v1/finding/project/${projectUuid}`,
        ),
      );
      return Array.isArray(response.data) ? response.data : [];
    }
  }

  private createEmptyDashboard(message: string): DependencyTrackDashboardDto {
    return {
      status: 'pending',
      message,
      syncCron: this.syncCron,
      severity: this.createSeveritySummary([]),
      total: 0,
      projects: [],
      vulnerabilities: [],
    };
  }

  private createSeveritySummary(
    vulnerabilities: DependencyTrackVulnerabilityDto[],
  ): DependencyTrackSeveritySummaryDto {
    return vulnerabilities.reduce<DependencyTrackSeveritySummaryDto>(
      (summary, vulnerability) => {
        const severity = vulnerability.severity.toLowerCase();
        if (severity === 'critical') summary.critical += 1;
        else if (severity === 'high') summary.high += 1;
        else if (severity === 'medium') summary.medium += 1;
        else if (severity === 'low') summary.low += 1;
        else if (severity === 'info') summary.info += 1;
        else summary.unknown += 1;
        return summary;
      },
      {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        unknown: 0,
      },
    );
  }

  private getSeverityRank(severity: string): number {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 0;
      case 'high':
        return 1;
      case 'medium':
        return 2;
      case 'low':
        return 3;
      case 'info':
        return 4;
      default:
        return 5;
    }
  }

  private mapVulnerabilities(
    input: unknown,
  ): DependencyTrackVulnerabilityDto[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.map((item) => {
      const finding = item as DependencyTrackFinding;
      const vulnerability = finding.vulnerability || finding;
      const component = finding.component || finding;
      return {
        id:
          vulnerability.uuid ||
          vulnerability.vulnId ||
          finding.uuid ||
          finding.id ||
          '',
        name:
          vulnerability.title ||
          vulnerability.name ||
          finding.vulnerabilityName ||
          vulnerability.vulnName ||
          'Unknown vulnerability',
        description:
          vulnerability.description ||
          finding.details ||
          finding.vulnerabilityDescription ||
          'No description available.',
        severity:
          vulnerability.severity || finding.rating || finding.cvss || 'UNKNOWN',
        component:
          component.name ||
          finding.package ||
          finding.artifact ||
          finding.vulnerabilityName ||
          'Unknown component',
        version:
          component.version ||
          finding.componentVersion ||
          finding.projectVersion,
        source: finding.source || vulnerability.source || 'Dependency Track',
      };
    });
  }
}

type DependencyTrackUploadResponse = {
  project?: {
    uuid?: string;
    id?: string;
  };
  vulnerabilities?: unknown[];
  findings?: unknown[];
};

type DependencyTrackProject = {
  uuid: string;
  name?: string;
  version?: string;
};

type DependencyTrackFindingExport = {
  findings?: unknown[];
};

type DependencyTrackFinding = {
  uuid?: string;
  id?: string;
  vulnId?: string;
  name?: string;
  title?: string;
  vulnerabilityName?: string;
  vulnName?: string;
  description?: string;
  details?: string;
  vulnerabilityDescription?: string;
  severity?: string;
  rating?: string;
  cvss?: string;
  component?: {
    name?: string;
    version?: string;
  };
  package?: string;
  artifact?: string;
  version?: string;
  componentVersion?: string;
  projectVersion?: string;
  source?: string;
  origin?: string;
  vulnerability?: {
    uuid?: string;
    vulnId?: string;
    name?: string;
    title?: string;
    vulnName?: string;
    description?: string;
    severity?: string;
    source?: string;
  };
};
