import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import SeverityBadge from '@/components/ui/severity-badge';
import {
  getDependencyTrackDashboard,
  syncDependencyTrackDashboard,
} from '@/services/apis/dependency-track';

dayjs.extend(relativeTime);

const queryKey = ['dependency-track-dashboard'];

export default function DependencyTrackVulnerabilities() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: getDependencyTrackDashboard,
    refetchInterval: 60_000,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: syncDependencyTrackDashboard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.success('Dependency Track dashboard sync started');
    },
    onError: () => {
      toast.error('Failed to sync Dependency Track dashboard');
    },
  });

  const severityItems = data
    ? [
        { severity: 'critical', count: data.severity.critical },
        { severity: 'high', count: data.severity.high },
        { severity: 'medium', count: data.severity.medium },
        { severity: 'low', count: data.severity.low },
      ]
    : [];

  const hasError = isError || data?.status === 'error';

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>Dependency Track</CardTitle>
          {hasError ? (
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          )}
        </div>
        <Button
          size="icon"
          variant="secondary"
          disabled={isPending}
          onClick={() => mutate()}
          aria-label="Sync Dependency Track vulnerabilities"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-8 w-24 rounded-md bg-muted" />
            <div className="h-20 rounded-md bg-muted" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Findings</p>
                <p className="font-mono text-3xl font-bold">
                  {data?.total ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last sync</p>
                <p className="text-sm font-medium">
                  {data?.lastSyncedAt
                    ? dayjs(data.lastSyncedAt).fromNow()
                    : 'Not synced'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {severityItems.map((item) => (
                <div
                  key={item.severity}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5"
                >
                  <SeverityBadge severity={item.severity} />
                  <span className="font-mono text-sm font-semibold">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>

            {hasError ? (
              <p className="rounded-md border border-orange-500 bg-orange-100 p-3 text-sm text-orange-700">
                {data?.lastError || 'Dependency Track sync is unavailable.'}
              </p>
            ) : null}

            {data?.vulnerabilities.length ? (
              <div className="space-y-2">
                {data.vulnerabilities.slice(0, 4).map((item) => (
                  <div
                    key={`${item.id}-${item.component}-${item.version || ''}`}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.component}
                          {item.version ? `@${item.version}` : ''}
                        </p>
                      </div>
                      <SeverityBadge severity={item.severity} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No synchronized Dependency Track vulnerabilities yet.
              </p>
            )}

            <Button asChild size="sm" variant="secondary" className="w-full">
              <Link to="/dependency-track">Open Dependency Track</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
