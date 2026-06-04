import { useNavigate } from 'react-router-dom';
import Page from '@/components/common/page';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import CreateWorkspace from '../workspaces/create-workspace';
import AssetLocationsMap from './components/asset-locations-map';
import { AssetTrends } from './components/asset-trends';
import IssuesTimeline from './components/issues-timeline';
import Statistic from './components/statistic';
import TlsStatistics from './components/tls-statistics';
import TopAssetsVulnerabilitiesChart from './components/top-assets-vulnerabilities-chart';
import VulnerabilityStatistic from './components/vulnerabilities-statistic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { workspaces, isLoading } = useWorkspaceSelector();

  if (isLoading) return <Page title="Dashboard" />;

  if (workspaces.length === 0) {
    return (
      <Page title="Dashboard">
        <CreateWorkspace />
      </Page>
    );
  }

  const navigate = useNavigate();

  return (
    <Page title="Dashboard">
      <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4">
        <div className="col-span-1 2xl:col-span-3 space-y-4 2xl:order-1">
          <Statistic />
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <IssuesTimeline />
            <AssetTrends />

            <TopAssetsVulnerabilitiesChart />
            <AssetLocationsMap />
          </div>
        </div>
        <div className="col-span-1 space-y-4 order-first 2xl:order-2">
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1 gap-4">
            <VulnerabilityStatistic />
            <TlsStatistics />
            <Card className="cursor-pointer hover:bg-muted/80 transition-colors">
              <CardHeader className="flex items-center justify-between gap-2">
                <CardTitle>Internal networks</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/internal-networks')}
                >
                  View
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage internal network interfaces, IP addresses, and private targets.
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/80 transition-colors">
              <CardHeader className="flex items-center justify-between gap-2">
                <CardTitle>Dependency Track</CardTitle>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/dependency-track')}
                >
                  Open
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Run SBOM vulnerability scans through the configured Dependency Track service.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="col-span-1 2xl:col-span-3 min-h-96 order-last"></div>
      </div>
    </Page>
  );
}
