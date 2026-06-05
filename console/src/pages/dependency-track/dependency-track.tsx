import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import Page from '@/components/common/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  checkSbomVulnerabilities,
  saveDependencyTrackLatestResult,
  type DependencyTrackCheckResponseDto,
} from '@/services/apis/dependency-track';

export default function DependencyTrackPage() {
  const [sbomUrl, setSbomUrl] = useState('');
  const [response, setResponse] = useState<DependencyTrackCheckResponseDto | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (url: string) => checkSbomVulnerabilities({ sbomUrl: url }),
    onSuccess: (result) => {
      setResponse(result);
      saveDependencyTrackLatestResult({
        ...result,
        sbomUrl: sbomUrl.trim(),
        scannedAt: new Date().toISOString(),
      });
      toast.success('Dependency Track scan completed successfully');
    },
    onError: (error: unknown) => {
      setResponse(null);
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to run Dependency Track scan',
      );
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sbomUrl.trim()) {
      toast.error('Please enter a valid SBOM URL');
      return;
    }
    mutate(sbomUrl.trim());
  };

  return (
    <Page title="Dependency Track">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Track SBOM scan</CardTitle>
              <CardDescription>
                Upload an SBOM URL to check for known component vulnerabilities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="sbom-url">SBOM URL</Label>
                  <Input
                    id="sbom-url"
                    value={sbomUrl}
                    placeholder="https://example.com/sbom.json"
                    onChange={(event) => setSbomUrl(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Scanning…' : 'Run scan'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    The new scan is executed against the configured Dependency Track instance.
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>

          {response ? (
            <Card>
              <CardHeader>
                <CardTitle>Scan results</CardTitle>
                <CardDescription>{response.message}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {response.projectUuid ? (
                  <div className="rounded-md border border-border bg-muted p-4 text-sm">
                    <div className="font-medium">Project UUID</div>
                    <div className="break-all text-sm text-muted-foreground">
                      {response.projectUuid}
                    </div>
                  </div>
                ) : null}
                {response.vulnerabilities.length === 0 ? (
                  <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
                    No vulnerabilities were found for the provided SBOM.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {response.vulnerabilities.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-background p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-muted-foreground">{item.component}</p>
                          </div>
                          <div className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase text-foreground">
                            {item.severity}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                        {item.version ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Version: {item.version}
                          </p>
                        ) : null}
                        {item.source ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Source: {item.source}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                The SBOM is sent to Dependency Track and analyzed for component vulnerabilities. Use a hosted SBOM URL or a cloud storage link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                This feature helps you detect exposed dependencies and insecure components before they become incidents.
              </p>
              <p>
                If you need a private scan, ensure your Dependency Track instance has network access to the SBOM URL.
              </p>
              <p>
                You can also verify the service health with the Dependency Track status endpoint if needed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
