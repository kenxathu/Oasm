import { axiosInstance } from '@/services/apis/axios-client';
import type { DefaultMessageResponseDto } from './gen/queries';

export const startJobHistoryScan = (
  id: string,
): Promise<DefaultMessageResponseDto> => {
  return axiosInstance.post(
    `/api/jobs-registry/histories/${id}/start`,
  ) as unknown as Promise<DefaultMessageResponseDto>;
};

export const stopJobHistoryScan = (
  id: string,
): Promise<DefaultMessageResponseDto> => {
  return axiosInstance.post(
    `/api/jobs-registry/histories/${id}/stop`,
  ) as unknown as Promise<DefaultMessageResponseDto>;
};

export const updateJobHistoryPipeline = ({
  id,
  toolNames,
}: {
  id: string;
  toolNames: string[];
}): Promise<DefaultMessageResponseDto> => {
  return axiosInstance.patch(`/api/jobs-registry/histories/${id}/pipeline`, {
    toolNames,
  }) as unknown as Promise<DefaultMessageResponseDto>;
};
