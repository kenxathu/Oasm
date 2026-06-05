import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { DependencyTrackService } from './dependency-track.service';

describe('DependencyTrackService', () => {
  const createService = (config: Record<string, string | undefined> = {}) => {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    const httpService = {
      get: jest.fn(() => of({ data: { status: 'UP' } })),
      post: jest.fn(() =>
        of({
          data: {
            project: { uuid: 'project-1' },
            findings: [
              {
                vulnId: 'CVE-2026-0001',
                name: 'Example vulnerability',
                description: 'Example description',
                severity: 'HIGH',
                component: 'example-lib',
                version: '1.0.0',
              },
            ],
          },
        }),
      ),
      axiosRef: {
        defaults: {
          headers: {
            common: {},
          },
        },
      },
    };

    const service = new DependencyTrackService(
      configService,
      httpService as never,
    );

    return { service, httpService };
  };

  it('syncs the configured BOM URL and exposes the latest dashboard summary', async () => {
    const { service } = createService({
      DEPENDENCY_TRACK_BASE_URL: 'http://dependency-track.local',
      DEPENDENCY_TRACK_API_KEY: 'api-key',
      DEPENDENCY_TRACK_BOM_URL: 'https://example.com/sbom.json',
    });

    await service.syncConfiguredBom();

    expect(service.getDashboardSummary()).toEqual({
      configured: true,
      lastSyncAt: expect.any(String),
      message: 'SBOM imported successfully into Dependency Track.',
      projectUuid: 'project-1',
      sbomUrl: 'https://example.com/sbom.json',
      status: 'ready',
      vulnerabilities: [
        {
          id: 'CVE-2026-0001',
          name: 'Example vulnerability',
          description: 'Example description',
          severity: 'HIGH',
          component: 'example-lib',
          version: '1.0.0',
          source: 'Dependency Track',
        },
      ],
      vulnerabilityCount: 1,
    });
  });

  it('reports dashboard summary as not configured when BOM URL is missing', () => {
    const { service } = createService({
      DEPENDENCY_TRACK_BASE_URL: 'http://dependency-track.local',
      DEPENDENCY_TRACK_API_KEY: 'api-key',
    });

    expect(service.getDashboardSummary()).toEqual({
      configured: false,
      message: 'DEPENDENCY_TRACK_BOM_URL is not configured',
      status: 'not_configured',
      vulnerabilities: [],
      vulnerabilityCount: 0,
    });
  });
});
