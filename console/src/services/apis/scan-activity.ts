import { axiosInstance } from '@/services/apis/axios-client';
import type { JobStatus } from '@/services/apis/gen/queries';

export type JobRunType = 'manual' | 'scheduled';

export type ScanActivityWorkerDto = {
  id: string;
  name?: string;
  os?: string;
  ipAddress?: string;
  type: string;
  scope: string;
  isOnline: boolean;
  currentJobsCount: number;
  lastSeenAt: string;
};

export type ScanActivityLogDto = {
  id: string;
  status: JobStatus;
  message: string;
  targetId?: string;
  target?: string;
  asset?: string;
  tool?: string;
  workerId?: string;
  workerName?: string;
  command?: string;
  jobRunType?: JobRunType;
  errorLogs: string[];
  createdAt: string;
  updatedAt: string;
  pickJobAt?: string;
  completedAt?: string;
};

export type ScanActivityResponseDto = {
  workers: ScanActivityWorkerDto[];
  logs: ScanActivityLogDto[];
  activeJobsCount: number;
  pendingJobsCount: number;
};

export const getScanActivity = (): Promise<ScanActivityResponseDto> => {
  return axiosInstance.get(
    '/api/jobs-registry/scan-activity',
  ) as unknown as Promise<ScanActivityResponseDto>;
};
