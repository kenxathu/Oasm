import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import type { VulnerabilitiesControllerGetVulnerabilitiesStatisticsParams } from '@/services/apis/gen/queries';
import { useVulnerabilitiesControllerGetVulnerabilitiesStatistics } from '@/services/apis/gen/queries';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';

type VulnerabilityStatisticParams =
  VulnerabilitiesControllerGetVulnerabilitiesStatisticsParams & {
    assetServiceIds?: string[];
  };

interface VulnerabilitiesStatisticProps {
  targetId?: string;
  assetServiceId?: string;
}
const VulnerabilitiesStatistic = ({
  targetId,
  assetServiceId,
}: VulnerabilitiesStatisticProps) => {
  const { selectedWorkspace } = useWorkspaceSelector();
  const [searchParams] = useSearchParams();

  const urlTargetId = searchParams.get('targetId') || undefined;
  const urlAssetServiceId = searchParams.get('assetServiceId') || undefined;

  const effectiveTargetId = targetId || urlTargetId;
  const effectiveAssetServiceId = assetServiceId || urlAssetServiceId;

  const statisticParams: VulnerabilityStatisticParams = {
    workspaceId: selectedWorkspace ?? '',
    targetIds: effectiveTargetId ? [effectiveTargetId] : undefined,
    assetServiceIds: effectiveAssetServiceId
      ? [effectiveAssetServiceId]
      : undefined,
  };

  const { data, isLoading } =
    useVulnerabilitiesControllerGetVulnerabilitiesStatistics(
      statisticParams,
      {
        query: {
          enabled: !!selectedWorkspace,
          refetchInterval: 5000,
        },
      },
    );

  // Create a map of severity to count for easy access
  const severityCounts = data?.data?.reduce(
    (acc, item) => {
      acc[item.severity] = item.count;
      return acc;
    },
    {} as Record<string, number>,
  ) || {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <div className="flex items-center gap-12">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex flex-col animate-pulse">
            <div className="h-4 bg-muted rounded w-16 mb-1"></div>
            <div className="h-8 bg-muted rounded w-8"></div>
          </div>
        ))}
      </div>
    );
  }

  const severityConfig = [
    { key: 'critical', label: 'Critical', color: 'text-red-500' },
    { key: 'high', label: 'High', color: 'text-orange-500' },
    { key: 'medium', label: 'Medium', color: 'text-yellow-500' },
    { key: 'low', label: 'Low', color: 'text-blue-500' },
    { key: 'info', label: 'Info', color: '' },
  ];

  return (
    <div className="flex items-center gap-12">
      {severityConfig.map(({ key, label, color }) => (
        <div key={key} className="flex flex-col">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className={clsx('text-2xl font-bold ', color)}>
            {severityCounts[key]}
          </span>
        </div>
      ))}
    </div>
  );
};

export default VulnerabilitiesStatistic;
