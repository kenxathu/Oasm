import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import { of, throwError } from 'rxjs';
import { DependencyTrackService } from './dependency-track.service';

describe('DependencyTrackService', () => {
  const flushPromises = () =>
    new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

  const getFormValue = (formData: FormData, key: string) =>
    Array.from(formData.entries()).find(([field]) => field === key)?.[1];

  const getUploadedBomJson = async <T>(formData: FormData): Promise<T> => {
    const bom = getFormValue(formData, 'bom');
    expect(bom).toBeInstanceOf(Blob);

    return JSON.parse(await (bom as Blob).text()) as T;
  };

  const createService = ({
    config = {},
    get,
    post,
  }: {
    config?: Record<string, string | undefined>;
    get?: jest.Mock;
    post?: jest.Mock;
  } = {}) => {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    const httpGet =
      get ??
      jest.fn((url: string) => {
        if (url === '/api/v1/project') {
          return of({
            data: [
              { uuid: 'project-1', name: 'Example project', version: '1.0.0' },
            ],
          });
        }

        if (url === '/api/v1/finding/project/project-1/export') {
          return of({
            data: {
              findings: [
                {
                  vulnerability: {
                    uuid: 'CVE-2026-0001',
                    name: 'Example vulnerability',
                    description: 'Example description',
                    severity: 'HIGH',
                  },
                  component: {
                    name: 'example-lib',
                    version: '1.0.0',
                  },
                },
              ],
            },
          });
        }

        return of({ data: { status: 'UP' } });
      });

    const httpService = {
      get: httpGet,
      post:
        post ??
        jest.fn(() =>
          of({
            data: {
              project: { uuid: 'uploaded-project' },
              findings: [
                {
                  vulnId: 'CVE-2026-0002',
                  name: 'Uploaded SBOM vulnerability',
                  description: 'Uploaded SBOM description',
                  severity: 'CRITICAL',
                  component: { name: 'uploaded-lib', version: '2.0.0' },
                },
              ],
            },
          }),
        ),
      axiosRef: {
        defaults: {
          headers: {
            common: {} as Record<string, string>,
          },
        },
      },
    };

    const schedulerRegistry = {
      addCronJob: jest.fn(),
    } as unknown as SchedulerRegistry;

    const service = new DependencyTrackService(
      configService,
      httpService as never,
      schedulerRegistry,
    );

    return {
      service,
      httpGet,
      httpPost: httpService.post,
      httpHeaders: httpService.axiosRef.defaults.headers.common,
    };
  };

  const dependencyTrackConfig = {
    DEPENDENCY_TRACK_BASE_URL: 'http://dependency-track.local',
    DEPENDENCY_TRACK_API_KEY: 'api-key',
  };

  it('configures Dependency-Track requests with the API key header', () => {
    const { httpHeaders } = createService({
      config: dependencyTrackConfig,
    });

    expect(httpHeaders['X-Api-Key']).toBe('api-key');
    expect(httpHeaders.Authorization).toBeUndefined();
  });

  it('requires a Dependency-Track API key', () => {
    expect(() =>
      createService({
        config: {
          DEPENDENCY_TRACK_BASE_URL: 'http://dependency-track.local',
        },
      }),
    ).toThrow('Set DEPENDENCY_TRACK_API_KEY');
  });

  it('does not crash startup when Dependency-Track is configured but unreachable', async () => {
    const { service } = createService({
      config: dependencyTrackConfig,
      get: jest.fn(() =>
        throwError(() => new Error('connect ECONNREFUSED 127.0.0.1:8080')),
      ),
    });

    await flushPromises();

    expect(service.getDashboardSummary()).toMatchObject({
      status: 'error',
      message: 'Dependency-Track connection failed.',
      lastError:
        'Dependency Track connection failed: connect ECONNREFUSED 127.0.0.1:8080',
    });
  });

  it('syncs Dependency-Track project findings into the dashboard summary', async () => {
    const { service } = createService({
      config: dependencyTrackConfig,
    });

    await service.syncDashboardVulnerabilities();

    expect(service.getDashboardSummary()).toMatchObject({
      status: 'ok',
      message: 'Dependency-Track vulnerabilities synchronized successfully.',
      total: 1,
      projects: [
        {
          uuid: 'project-1',
          name: 'Example project',
          version: '1.0.0',
          findings: 1,
        },
      ],
      vulnerabilities: [
        {
          id: 'CVE-2026-0001',
          name: 'Example vulnerability',
          description: 'Example description',
          severity: 'HIGH',
          component: 'example-lib',
          version: '1.0.0',
          source: 'Dependency Track: Example project',
        },
      ],
    });
  });

  it('uploads a JSON SBOM file to Dependency-Track as multipart form data', async () => {
    const { service, httpPost } = createService({
      config: dependencyTrackConfig,
    });
    const sbom = {
      bomFormat: 'CycloneDX',
      metadata: {
        component: {
          name: 'oasm/oasm-console',
          version: 'latest',
        },
      },
    };
    const file = {
      originalname: 'oasm.spdx.json',
      mimetype: 'application/json',
      buffer: Buffer.from(JSON.stringify(sbom)),
    } as Express.Multer.File;

    const result = await service.checkSbomFileVulnerabilities(file);
    const formData = httpPost.mock.calls[0]?.[1] as FormData;

    expect(httpPost).toHaveBeenCalledWith(
      '/api/v1/bom',
      expect.any(FormData),
      {
        maxBodyLength: Infinity,
      },
    );
    expect(getFormValue(formData, 'autoCreate')).toBe('true');
    expect(getFormValue(formData, 'projectName')).toBe('oasm/oasm-console');
    expect(getFormValue(formData, 'projectVersion')).toBe('latest');
    expect(getFormValue(formData, 'bom')).toBeInstanceOf(Blob);
    expect(result).toMatchObject({
      projectUuid: 'uploaded-project',
      vulnerabilities: [
        {
          id: 'CVE-2026-0002',
          name: 'Uploaded SBOM vulnerability',
          severity: 'CRITICAL',
          component: 'uploaded-lib',
          version: '2.0.0',
        },
      ],
    });
  });

  it('normalizes duplicate CycloneDX dependencies before uploading an SBOM file', async () => {
    const { service, httpPost } = createService({
      config: dependencyTrackConfig,
    });
    const sbom = {
      bomFormat: 'CycloneDX',
      metadata: {
        component: {
          name: 'vuln-bank-web',
          version: 'latest',
        },
      },
      dependencies: [
        {
          ref: 'pkg:deb/debian/perl@5.40.1',
          dependsOn: ['file-a', 'file-b'],
        },
        {
          ref: 'pkg:deb/debian/perl@5.40.1',
          dependsOn: ['file-b', 'file-c'],
        },
        {
          ref: 'pkg:deb/debian/bash@5.2.37',
          dependsOn: ['file-d'],
        },
      ],
    };
    const file = {
      originalname: 'vulbank.spdx.json',
      mimetype: 'application/json',
      buffer: Buffer.from(JSON.stringify(sbom)),
    } as Express.Multer.File;

    await service.checkSbomFileVulnerabilities(file);

    const formData = httpPost.mock.calls[0]?.[1] as FormData;
    const uploadedBom = await getUploadedBomJson<{
      dependencies: Array<{ ref: string; dependsOn: string[] }>;
    }>(formData);

    expect(uploadedBom.dependencies).toEqual([
      {
        ref: 'pkg:deb/debian/perl@5.40.1',
        dependsOn: ['file-a', 'file-b', 'file-c'],
      },
      {
        ref: 'pkg:deb/debian/bash@5.2.37',
        dependsOn: ['file-d'],
      },
    ]);
  });

  it('waits for Dependency-Track token processing and returns project findings', async () => {
    const httpGet = jest.fn((url: string) => {
      if (url === '/api/v1/project') {
        return of({ data: [] });
      }

      if (url === '/api/v1/event/token/upload-token') {
        return of({ data: { processing: false } });
      }

      if (url === '/api/v1/project/lookup') {
        return of({
          data: {
            uuid: 'resolved-project',
            name: 'vuln-bank-web',
            version: 'latest',
          },
        });
      }

      if (url === '/api/v1/finding/project/resolved-project/export') {
        return of({
          data: {
            findings: [
              {
                vulnerability: {
                  vulnId: 'CVE-2026-0003',
                  name: 'Processed vulnerability',
                  description: 'Processed vulnerability description',
                  severity: 'HIGH',
                },
                component: {
                  name: 'processed-lib',
                  version: '3.0.0',
                },
              },
            ],
          },
        });
      }

      return of({ data: {} });
    });
    const { service } = createService({
      config: {
        ...dependencyTrackConfig,
        DEPENDENCY_TRACK_BOM_PROCESSING_POLL_INTERVAL_MS: '1',
      },
      get: httpGet,
      post: jest.fn(() =>
        of({
          data: {
            token: 'upload-token',
          },
        }),
      ),
    });
    const file = {
      originalname: 'vulbank.spdx.json',
      mimetype: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          bomFormat: 'CycloneDX',
          metadata: {
            component: {
              name: 'vuln-bank-web',
              version: 'latest',
            },
          },
        }),
      ),
    } as Express.Multer.File;

    const result = await service.checkSbomFileVulnerabilities(file);

    expect(httpGet).toHaveBeenCalledWith('/api/v1/event/token/upload-token');
    expect(httpGet).toHaveBeenCalledWith('/api/v1/project/lookup', {
      params: {
        name: 'vuln-bank-web',
        version: 'latest',
      },
    });
    expect(result).toMatchObject({
      projectUuid: 'resolved-project',
      vulnerabilities: [
        {
          id: 'CVE-2026-0003',
          name: 'Processed vulnerability',
          severity: 'HIGH',
          component: 'processed-lib',
          version: '3.0.0',
        },
      ],
    });
  });

  it('rejects uploaded SBOM files that are not JSON files', async () => {
    const { service } = createService({
      config: dependencyTrackConfig,
    });
    const file = {
      originalname: 'sbom.xml',
      mimetype: 'application/xml',
      buffer: Buffer.from('<bom />'),
    } as Express.Multer.File;

    await expect(service.checkSbomFileVulnerabilities(file)).rejects.toThrow(
      'Only .json SBOM files are supported',
    );
  });
});
