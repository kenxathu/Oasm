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

export type CheckSbomDto = {
  sbomUrl: string;
};

export const checkSbomVulnerabilities = (
  data: CheckSbomDto,
): Promise<DependencyTrackCheckResponseDto> => {
  return axiosInstance.post<DependencyTrackCheckResponseDto>(
    '/api/dependency-track/sbom',
    data,
  );
};
