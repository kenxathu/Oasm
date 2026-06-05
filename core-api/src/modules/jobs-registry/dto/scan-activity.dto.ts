import { JobRunType, JobStatus } from '@/common/enums/enum';
import { ApiProperty } from '@nestjs/swagger';

export class ScanActivityWorkerDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  os?: string;

  @ApiProperty({ required: false })
  ipAddress?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  scope: string;

  @ApiProperty()
  isOnline: boolean;

  @ApiProperty()
  currentJobsCount: number;

  @ApiProperty()
  lastSeenAt: Date;
}

export class ScanActivityLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: JobStatus })
  status: JobStatus;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  targetId?: string;

  @ApiProperty({ required: false })
  target?: string;

  @ApiProperty({ required: false })
  asset?: string;

  @ApiProperty({ required: false })
  tool?: string;

  @ApiProperty({ required: false })
  workerId?: string;

  @ApiProperty({ required: false })
  workerName?: string;

  @ApiProperty({ required: false })
  command?: string;

  @ApiProperty({ enum: JobRunType, required: false })
  jobRunType?: JobRunType;

  @ApiProperty({ type: [String] })
  errorLogs: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  pickJobAt?: Date;

  @ApiProperty({ required: false })
  completedAt?: Date;
}

export class ScanActivityResponseDto {
  @ApiProperty({ type: [ScanActivityWorkerDto] })
  workers: ScanActivityWorkerDto[];

  @ApiProperty({ type: [ScanActivityLogDto] })
  logs: ScanActivityLogDto[];

  @ApiProperty()
  activeJobsCount: number;

  @ApiProperty()
  pendingJobsCount: number;
}
