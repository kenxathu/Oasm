import type { AssetTag } from '@/modules/assets/entities/asset-tags.entity';
import type { Asset } from '@/modules/assets/entities/assets.entity';
import type { HttpResponse } from '@/modules/assets/entities/http-response.entity';
import type { Vulnerability } from '@/modules/vulnerabilities/entities/vulnerability.entity';
import type { ScreenshotPayload } from '@/common/interfaces/app.interface';

export type JobDataResultType =
  | Asset[]
  | HttpResponse
  | number[]
  | Vulnerability[]
  | ScreenshotPayload
  | AssetTag[]
  | undefined;
