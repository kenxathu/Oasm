import { type FormEvent, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileJson, Link as LinkIcon, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Page from '@/components/common/page';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  checkSbomFileVulnerabilities,
  checkSbomVulnerabilities,
  saveDependencyTrackLatestResult,
  type DependencyTrackCheckResponseDto,
} from '@/services/apis/dependency-track';

type ScanPayload =
  | {
      type: 'url';
      url: string;
    }
  | {
      type: 'file';
      file: File;
    };

export default function DependencyTrackPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sbomUrl, setSbomUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [response, setResponse] =
    useState<DependencyTrackCheckResponseDto | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: ScanPayload) => {
      if (payload.type === 'url') {
        return checkSbomVulnerabilities({ sbomUrl: payload.url });
      }

      return checkSbomFileVulnerabilities(payload.file);
    },
    onSuccess: (result, payload) => {
      setResponse(result);
      saveDependencyTrackLatestResult({
        ...result,
        source: payload.type,
        sbomUrl: payload.type === 'url' ? payload.url : undefined,
        sbomFileName: payload.type === 'file' ? payload.file.name : undefined,
        scannedAt: new Date().toISOString(),
      });
      toast.success('Dependency Track scan completed successfully');
    },
    onError: (error: unknown) => {
      setResponse(null);
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? 'Failed to run Dependency Track scan',
      );
    },
  });

  const handleUrlSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = sbomUrl.trim();

    if (!url) {
      toast.error('Please enter a valid SBOM URL');
      return;
    }

    mutate({ type: 'url', url });
  };

  const handleFileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      toast.error('Please choose an sbom.json file');
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.json')) {
      toast.error('Only .json SBOM files are supported');
      return;
    }

    try {
      JSON.parse(await selectedFile.text());
    } catch {
      toast.error('The selected SBOM file must contain valid JSON');
      return;
    }

    mutate({ type: 'file', file: selectedFile });
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <Page title="Dependency Track">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Track SBOM scan</CardTitle>
              <CardDescription>
                Check known component vulnerabilities from a hosted SBOM URL or
                an uploaded sbom.json file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="url" className="gap-4">
                <TabsList className="grid h-auto w-full grid-cols-2">
                  <TabsTrigger value="url" className="h-9">
                    <LinkIcon />
                    SBOM URL
                  </TabsTrigger>
                  <TabsTrigger value="file" className="h-9">
                    <FileJson />
                    sbom.json file
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url">
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
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
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="gap-2"
                      >
                        {isPending ? <Loader2 className="animate-spin" /> : null}
                        {isPending ? 'Scanning...' : 'Scan SBOM URL'}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        The URL must be reachable by the configured
                        Dependency-Track instance.
                      </span>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="file">
                  <form
                    onSubmit={(event) => void handleFileSubmit(event)}
                    className="space-y-4"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="sbom-file">SBOM file</Label>
                      <input
                        ref={fileInputRef}
                        id="sbom-file"
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={(event) =>
                          setSelectedFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <div className="flex flex-col gap-3 rounded-md border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {selectedFile?.name ?? 'No file selected'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Upload a JSON SBOM file, for example sbom.json.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={handleChooseFile}
                        >
                          <Upload />
                          Choose file
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="gap-2"
                      >
                        {isPending ? <Loader2 className="animate-spin" /> : null}
                        {isPending ? 'Uploading...' : 'Upload and scan'}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        The file is sent to Dependency-Track as an
                        application/json SBOM.
                      </span>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
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
                        className="rounded-md border border-border bg-background p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.component}
                            </p>
                          </div>
                          <div className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase text-foreground">
                            {item.severity}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          {item.description}
                        </p>
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
                Dependency-Track imports the SBOM and analyzes component
                inventory against known vulnerability intelligence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Use the URL option when the SBOM is hosted and reachable by the
                API service.
              </p>
              <p>
                Use the file option when you have a local CycloneDX or SPDX JSON
                SBOM.
              </p>
              <p>
                The latest scan result is summarized in the sidebar badge for
                quick follow-up.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
