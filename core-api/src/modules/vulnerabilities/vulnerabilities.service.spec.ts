import { SortOrder } from '@/common/dtos/get-many-base.dto';
import { randomUUID } from 'crypto';
import { VulnerabilitiesService } from './vulnerabilities.service';

function createQueryBuilderMock() {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
}

describe('VulnerabilitiesService', () => {
  let service: VulnerabilitiesService;
  let queryBuilder: ReturnType<typeof createQueryBuilderMock>;
  let vulnerabilitiesRepository: { createQueryBuilder: jest.Mock };

  beforeEach(() => {
    queryBuilder = createQueryBuilderMock();
    vulnerabilitiesRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    service = new VulnerabilitiesService(
      vulnerabilitiesRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('filters vulnerabilities by asset service ids', async () => {
    const assetServiceId = randomUUID();

    await service.getVulnerabilities(
      {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: SortOrder.DESC,
        assetServiceIds: [assetServiceId],
      } as any,
      randomUUID(),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('asset_services asset_service_filter'),
      { assetServiceIds: [assetServiceId] },
    );
  });

  it('filters vulnerability statistics by asset service ids', async () => {
    const assetServiceId = randomUUID();

    await service.getVulnerabilitiesStatistics({
      workspaceId: randomUUID(),
      assetServiceIds: [assetServiceId],
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('asset_services asset_service_filter'),
      { assetServiceIds: [assetServiceId] },
    );
  });
});
