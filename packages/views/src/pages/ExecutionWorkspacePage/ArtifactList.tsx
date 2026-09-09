import { useCreate, useList } from "@refinedev/core";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import type { ExecutionArtifact } from "@repo/schemas";
import { useJobData } from "./useJobData";
import { useWorkspaceData } from "./useWorkspaceData";
export const ArtifactList = () => {
  const { jobId, live, job } = useJobData();
  const { act, busy } = useWorkspaceData();
  const { result, query } = useList<ExecutionArtifact>({
    resource: "job-artifacts",
    meta: { jobId, revision: job.result?.revision },
    pagination: { mode: "off" },
    queryOptions: { enabled: Boolean(jobId), retry: false, refetchInterval: live ? 2000 : false },
  });
  const { mutateAsync } = useCreate<{
    id: string;
    name: string;
    blob: Blob;
  }>({ mutationOptions: { retry: false } });
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void query.refetch();

  return (
    <Card className="space-y-4 p-5" variant="surface">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">已发布文件</h3>
        <Button size="sm" variant="ghost" onClick={handleClick1}>
          刷新文件
        </Button>
      </div>
      {query.isLoading && <p role="status">读取文件列表…</p>}
      {query.error && (
        <p className="text-sm text-destructive" role="alert">
          {query.error.message}
        </p>
      )}
      {result.data.length === 0 && !query.isLoading && (
        <p className="text-sm text-muted-foreground">
          尚无已发布文件。Job ID 或状态不会代替实际交付。
        </p>
      )}
      {result.data
        .filter((artifact) => artifact.state === "published")
        .map((artifact) => {
          const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
            void act(
              "下载并校验 SHA-256",
              () =>
                mutateAsync({
                  resource: "artifact-download",
                  values: { id: artifact.artifactId },
                }),
              (response) => {
                const url = URL.createObjectURL(response.data.blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = response.data.name;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              },
            );

          return (
            <div key={artifact.artifactId} className="space-y-2 rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{artifact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {artifact.mimeType} · {artifact.sizeBytes} bytes
                  </p>
                </div>
                <Button disabled={busy} size="sm" variant="outline" onClick={handleClick2}>
                  校验并下载
                </Button>
              </div>
              <p className="break-all font-mono text-xs">SHA-256 {artifact.sha256}</p>
              <p className="break-all text-xs text-muted-foreground">
                {artifact.jobId} / {artifact.nodeId} / {artifact.portId} / {artifact.attemptId}
              </p>
            </div>
          );
        })}
    </Card>
  );
};
