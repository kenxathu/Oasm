import { axiosInstance } from '@/services/apis/axios-client';

export type DependencyTrackVulnerabilityDto = {
  id: string;
  name: string;
  description: string;
  severity: string;
  component: string;
  version?: string;
  source?: string;
};

export type DependencyTrackCheckResponseDto = {
  projectUuid?: string;
  message: string;
  vulnerabilities: DependencyTrackVulnerabilityDto[];
};

export type DependencyTrackStatusDto = {
  status: string;
  message: string;
};

export type DependencyTrackSeveritySummaryDto = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  unknown: number;
};

export type DependencyTrackProjectSummaryDto = {
  uuid: string;
  name: string;
  version?: string;
  findings: number;
};

export type DependencyTrackDashboardDto = {
  status: string;
  message: string;
  syncCron: string;
  lastSyncedAt?: string;
  lastError?: string;
  severity: DependencyTrackSeveritySummaryDto;
  total: number;
  projects: DependencyTrackProjectSummaryDto[];
  vulnerabilities: DependencyTrackVulnerabilityDto[];
};

export type CheckSbomDto = {
  sbomUrl: string;
};

export type DependencyTrackLatestResult = DependencyTrackCheckResponseDto & {
  sbomUrl: string;
  scannedAt: string;
};

export const DEPENDENCY_TRACK_LATEST_RESULT_KEY =
  'dependency-track:latest-result';
export const DEPENDENCY_TRACK_LATEST_RESULT_EVENT =
  'dependency-track:latest-result-updated';

export const checkSbomVulnerabilities = (
  data: CheckSbomDto,
): Promise<DependencyTrackCheckResponseDto> => {
  return axiosInstance.post(
    '/api/dependency-track/sbom',
    data,
  ) as unknown as Promise<DependencyTrackCheckResponseDto>;
};

export const getDependencyTrackStatus =
  (): Promise<DependencyTrackStatusDto> => {
    return axiosInstance.get(
      '/api/dependency-track/status',
    ) as unknown as Promise<DependencyTrackStatusDto>;
  };

export const getDependencyTrackDashboard =
  (): Promise<DependencyTrackDashboardDto> => {
    return axiosInstance.get(
      '/api/dependency-track/dashboard',
    ) as unknown as Promise<DependencyTrackDashboardDto>;
  };

export const syncDependencyTrackDashboard =
  (): Promise<DependencyTrackDashboardDto> => {
    return axiosInstance.post(
      '/api/dependency-track/dashboard/sync',
    ) as unknown as Promise<DependencyTrackDashboardDto>;
  };

export const saveDependencyTrackLatestResult = (
  result: DependencyTrackLatestResult,
) => {
  localStorage.setItem(
    DEPENDENCY_TRACK_LATEST_RESULT_KEY,
    JSON.stringify(result),
  );
  window.dispatchEvent(new Event(DEPENDENCY_TRACK_LATEST_RESULT_EVENT));
};

export const getDependencyTrackLatestResult =
  (): DependencyTrackLatestResult | null => {
    const raw = localStorage.getItem(DEPENDENCY_TRACK_LATEST_RESULT_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as DependencyTrackLatestResult;
    } catch {
      localStorage.removeItem(DEPENDENCY_TRACK_LATEST_RESULT_KEY);
      return null;
    }
  };
