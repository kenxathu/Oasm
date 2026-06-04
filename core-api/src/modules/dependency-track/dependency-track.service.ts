import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { DependencyTrackCheckResponseDto } from './dtos/dependency-track-check-response.dto';
import { DependencyTrackVulnerabilityDto } from './dtos/dependency-track-vulnerability.dto';

@Injectable()
export class DependencyTrackService {
  private readonly logger = new Logger(DependencyTrackService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly username?: string;
  private readonly password?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('DEPENDENCY_TRACK_BASE_URL') || '';
    this.apiKey = this.configService.get<string>('DEPENDENCY_TRACK_API_KEY');
    this.username = this.configService.get<string>('DEPENDENCY_TRACK_USERNAME');
    this.password = this.configService.get<string>('DEPENDENCY_TRACK_PASSWORD');

    if (!this.baseUrl) {
      throw new Error('DEPENDENCY_TRACK_BASE_URL is not configured');
    }

    if (!this.apiKey && !(this.username && this.password)) {
      throw new Error(
        'Dependency Track authentication is not configured. Set DEPENDENCY_TRACK_API_KEY or DEPENDENCY_TRACK_USERNAME and DEPENDENCY_TRACK_PASSWORD.',
      );
    }

    this.httpService.axiosRef.defaults.baseURL = this.baseUrl;
    this.httpService.axiosRef.defaults.headers.common.Accept = 'application/json';

    if (this.apiKey) {
      this.httpService.axiosRef.defaults.headers.common['X-Api-Key'] = this.apiKey;
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

  async testConnection(): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.get('/api/v1/system/health'),
      );
      this.logger.log('Dependency Track connection established successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Dependency Track connection failed: ${message}`, error as any);
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
      const isJson = String(contentType).includes('json') || sbomUrl.endsWith('.json');
      const uploadResponse: AxiosResponse<any> = await firstValueFrom(
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
        uploadResponse.data?.vulnerabilities || uploadResponse.data?.findings || [];

      const vulnerabilities = this.mapVulnerabilities(rawVulnerabilities);

      return {
        projectUuid,
        message: 'SBOM imported successfully into Dependency Track.',
        vulnerabilities,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Dependency Track SBOM scan failed: ${message}`, error as any);
      throw new BadRequestException(
        `Failed to scan SBOM with Dependency Track: ${message}`,
      );
    }
  }

  private mapVulnerabilities(
    input: any,
  ): DependencyTrackVulnerabilityDto[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.map((item) => ({
      id: item.uuid || item.vulnId || item.id || '',
      name:
        item.title || item.name || item.vulnerabilityName ||
        item.vulnName ||
        'Unknown vulnerability',
      description:
        item.description || item.details || item.vulnerabilityDescription ||
        'No description available.',
      severity: item.severity || item.rating || item.cvss || 'UNKNOWN',
      component:
        item.component || item.package || item.artifact ||
        item.vulnerabilityName ||
        'Unknown component',
      version: item.version || item.componentVersion || item.projectVersion,
      source: item.source || item.origin || 'Dependency Track',
    }));
  }
}
