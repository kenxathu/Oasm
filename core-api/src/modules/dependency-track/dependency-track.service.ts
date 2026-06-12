import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { AxiosProxyConfig, AxiosResponse } from 'axios';
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
  private static readonly DEFAULT_BOM_PROCESSING_TIMEOUT_MS = 30000;
  private static readonly DEFAULT_BOM_PROCESSING_POLL_INTERVAL_MS = 1000;
  private readonly logger = new Logger(DependencyTrackService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly syncCron: string;
  private readonly bomProcessingTimeoutMs: number;
  private readonly bomProcessingPollIntervalMs: number;
  private readonly proxyUrl?: string;
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
    this.syncCron =
      this.configService.get<string>('DEPENDENCY_TRACK_SYNC_CRON') ||
      DependencyTrackService.DEFAULT_SYNC_CRON;
    this.bomProcessingTimeoutMs = this.getConfigNumber(
      'DEPENDENCY_TRACK_BOM_PROCESSING_TIMEOUT_MS',
      DependencyTrackService.DEFAULT_BOM_PROCESSING_TIMEOUT_MS,
    );
    this.bomProcessingPollIntervalMs = this.getConfigNumber(
      'DEPENDENCY_TRACK_BOM_PROCESSING_POLL_INTERVAL_MS',
      DependencyTrackService.DEFAULT_BOM_PROCESSING_POLL_INTERVAL_MS,
    );
    this.proxyUrl = this.configService.get<string>(
      'DEPENDENCY_TRACK_PROXY_URL',
    );
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

    if (!this.apiKey) {
      throw new Error(
        'Dependency Track authentication is not configured. Set DEPENDENCY_TRACK_API_KEY.',
      );
    }

    this.httpService.axiosRef.defaults.baseURL = this.baseUrl;
    this.httpService.axiosRef.defaults.headers.common.Accept =
      'application/json';

    this.httpService.axiosRef.defaults.headers.common['X-Api-Key'] =
      this.apiKey;
    this.configureProxy();

    void this.testConnection().catch((error: unknown) => {
      const message = this.getErrorMessage(error);
      this.dashboardCache = {
        ...this.dashboardCache,
        status: 'error',
        message: 'Dependency-Track connection failed.',
        lastError: message,
      };
    });
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
      await firstValueFrom(
        this.httpService.get('/api/v1/project', {
          params: {
            excludeInactive: true,
            onlyRoot: false,
          },
        }),
      );
      this.logger.log('Dependency Track connection established successfully');
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Dependency Track connection failed: ${message}`);
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

      const rawContentType = sbomResponse.headers['content-type'];
      const contentType =
        typeof rawContentType === 'string' ? rawContentType : 'application/json';
      const isJson =
        String(contentType).includes('json') || sbomUrl.endsWith('.json');

      return await this.uploadSbomContent(
        sbomResponse.data,
        isJson ? 'application/json' : 'application/xml',
        this.getFileNameFromUrl(sbomUrl) ?? 'sbom.json',
      );
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Dependency Track SBOM scan failed: ${message}`);
      throw new BadRequestException(
        `Failed to scan SBOM with Dependency Track: ${message}`,
      );
    }
  }

  async checkSbomFileVulnerabilities(
    file?: Express.Multer.File,
  ): Promise<DependencyTrackCheckResponseDto> {
    if (!file) {
      throw new BadRequestException('SBOM file is required');
    }

    const isJsonFile = file.originalname.toLowerCase().endsWith('.json');
    if (!isJsonFile) {
      throw new BadRequestException('Only .json SBOM files are supported');
    }

    const sbomContent = file.buffer.toString('utf-8');
    try {
      JSON.parse(sbomContent);
    } catch {
      throw new BadRequestException('SBOM file must contain valid JSON');
    }

    try {
      return await this.uploadSbomContent(
        sbomContent,
        'application/json',
        file.originalname,
      );
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Dependency Track SBOM file scan failed: ${message}`);
      throw new BadRequestException(
        `Failed to scan SBOM file with Dependency Track: ${message}`,
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
      const message = this.getErrorMessage(error);
      this.logger.error(`Dependency-Track dashboard sync failed: ${message}`);
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

  private async uploadSbomContent(
    content: string,
    contentType: 'application/json' | 'application/xml',
    fileName: string,
  ): Promise<DependencyTrackCheckResponseDto> {
    const formData = new FormData();
    const projectFields = this.resolveBomProjectFields(content, fileName);
    const uploadContent =
      contentType === 'application/json'
        ? this.normalizeCycloneDxBomContent(content)
        : content;

    if (this.projectUuid) {
      formData.append('project', this.projectUuid);
    } else {
      formData.append('autoCreate', 'true');
      formData.append('projectName', projectFields.projectName);
      formData.append('projectVersion', projectFields.projectVersion);
    }

    formData.append(
      'bom',
      new Blob([uploadContent], { type: contentType }),
      fileName,
    );

    const uploadResponse: AxiosResponse<DependencyTrackUploadResponse> =
      await firstValueFrom(
        this.httpService.post('/api/v1/bom', formData, {
          maxBodyLength: Infinity,
        }),
      );

    const projectUuid =
      uploadResponse.data?.project?.uuid || uploadResponse.data?.project?.id;
    const uploadToken = uploadResponse.data?.token;
    const rawVulnerabilities =
      uploadResponse.data?.vulnerabilities ||
      uploadResponse.data?.findings ||
      [];

    const processed = uploadToken
      ? await this.waitForBomProcessing(uploadToken).catch(() => false)
      : false;
    const resolvedProjectUuid =
      projectUuid ||
      (await this.resolveUploadedProjectUuid(projectFields).catch(
        () => undefined,
      ));

    const resolvedRawVulnerabilities =
      rawVulnerabilities.length > 0
        ? rawVulnerabilities
        : processed && resolvedProjectUuid
          ? await this.fetchProjectFindings(resolvedProjectUuid).catch(() => [])
          : [];
    const vulnerabilities = this.mapVulnerabilities(resolvedRawVulnerabilities);

    return {
      projectUuid: resolvedProjectUuid,
      message: 'SBOM imported successfully into Dependency Track.',
      vulnerabilities,
    };
  }

  private normalizeCycloneDxBomContent(content: string): string {
    const parsed = JSON.parse(content) as CycloneDxBom;
    if (parsed.bomFormat !== 'CycloneDX' || !Array.isArray(parsed.dependencies)) {
      return content;
    }

    const dependenciesByRef = new Map<string, CycloneDxDependency>();
    const dependenciesWithoutRef: unknown[] = [];

    for (const dependency of parsed.dependencies) {
      if (!this.isCycloneDxDependency(dependency)) {
        dependenciesWithoutRef.push(dependency);
        continue;
      }

      const existing = dependenciesByRef.get(dependency.ref);
      if (!existing) {
        dependenciesByRef.set(dependency.ref, {
          ...dependency,
          dependsOn: this.getUniqueStrings(dependency.dependsOn),
        });
        continue;
      }

      dependenciesByRef.set(dependency.ref, {
        ...existing,
        dependsOn: this.getUniqueStrings([
          ...(existing.dependsOn ?? []),
          ...(dependency.dependsOn ?? []),
        ]),
      });
    }

    return JSON.stringify({
      ...parsed,
      dependencies: [
        ...Array.from(dependenciesByRef.values()),
        ...dependenciesWithoutRef,
      ],
    });
  }

  private isCycloneDxDependency(
    value: unknown,
  ): value is CycloneDxDependency {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const dependency = value as { ref?: unknown; dependsOn?: unknown };
    return (
      typeof dependency.ref === 'string' &&
      (dependency.dependsOn === undefined ||
        (Array.isArray(dependency.dependsOn) &&
          dependency.dependsOn.every((item) => typeof item === 'string')))
    );
  }

  private getUniqueStrings(values: string[] | undefined): string[] | undefined {
    if (!values) {
      return undefined;
    }

    return Array.from(new Set(values));
  }

  private async resolveUploadedProjectUuid({
    projectName,
    projectVersion,
  }: {
    projectName: string;
    projectVersion: string;
  }): Promise<string | undefined> {
    const response = await firstValueFrom(
      this.httpService.get<DependencyTrackProject>('/api/v1/project/lookup', {
        params: {
          name: projectName,
          version: projectVersion,
        },
      }),
    );
    return response.data?.uuid;
  }

  private async waitForBomProcessing(token: string): Promise<boolean> {
    const deadline = Date.now() + this.bomProcessingTimeoutMs;

    while (Date.now() <= deadline) {
      const response = await firstValueFrom(
        this.httpService.get<DependencyTrackProcessingResponse>(
          `/api/v1/event/token/${token}`,
        ),
      );

      if (!response.data?.processing) {
        return true;
      }

      await this.sleep(this.bomProcessingPollIntervalMs);
    }

    return false;
  }

  private sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  private getFileNameFromUrl(url: string): string | null {
    try {
      const { pathname } = new URL(url);
      const fileName = pathname.split('/').filter(Boolean).at(-1);
      return fileName || null;
    } catch {
      return null;
    }
  }

  private getConfigNumber(key: string, fallback: number): number {
    const rawValue = this.configService.get<string>(key);
    if (!rawValue) {
      return fallback;
    }

    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private configureProxy(): void {
    const proxyUrl = this.proxyUrl?.trim();
    if (!proxyUrl) {
      return;
    }

    const proxy = this.parseProxyUrl(proxyUrl);
    this.httpService.axiosRef.defaults.proxy = proxy;
  }

  private parseProxyUrl(proxyUrl: string): AxiosProxyConfig {
    let parsed: URL;
    try {
      parsed = new URL(proxyUrl);
    } catch {
      throw new Error('DEPENDENCY_TRACK_PROXY_URL must be a valid URL');
    }

    const protocol = parsed.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error(
        'DEPENDENCY_TRACK_PROXY_URL must use http or https protocol',
      );
    }

    const port = parsed.port
      ? Number(parsed.port)
      : protocol === 'https'
        ? 443
        : 80;
    const proxy: AxiosProxyConfig = {
      protocol,
      host: parsed.hostname,
      port,
    };

    if (parsed.username) {
      proxy.auth = {
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      };
    }

    return proxy;
  }

  private resolveBomProjectFields(
    content: string,
    fileName: string,
  ): { projectName: string; projectVersion: string } {
    const fallbackProjectName =
      fileName.replace(/\.(cdx|spdx)?\.?json$/i, '') || 'Uploaded SBOM';
    const configuredProjectName = this.projectName?.trim();
    const configuredProjectVersion = this.projectVersion?.trim();

    if (configuredProjectName && configuredProjectVersion) {
      return {
        projectName: configuredProjectName,
        projectVersion: configuredProjectVersion,
      };
    }

    try {
      const parsed = JSON.parse(content) as {
        metadata?: {
          component?: {
            name?: string;
            version?: string;
          };
        };
      };
      return {
        projectName:
          configuredProjectName ||
          parsed.metadata?.component?.name ||
          fallbackProjectName,
        projectVersion:
          configuredProjectVersion ||
          parsed.metadata?.component?.version ||
          'latest',
      };
    } catch {
      return {
        projectName: configuredProjectName || fallbackProjectName,
        projectVersion: configuredProjectVersion || 'latest',
      };
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
  token?: string;
  vulnerabilities?: unknown[];
  findings?: unknown[];
};

type DependencyTrackProcessingResponse = {
  processing?: boolean;
};

type CycloneDxBom = {
  bomFormat?: string;
  dependencies?: unknown[];
  [key: string]: unknown;
};

type CycloneDxDependency = {
  ref: string;
  dependsOn?: string[];
  [key: string]: unknown;
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
