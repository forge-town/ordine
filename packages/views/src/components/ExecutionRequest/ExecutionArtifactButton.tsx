import { useState } from "react";
import { useCreate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import type { ExecutionArtifact } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { usePlatform } from "../../platform";

export const ExecutionArtifactButton = ({ artifact }: { artifact: ExecutionArtifact }) => {
  const platform = usePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync } = useCreate<{ id: string; name: string; blob: Blob }>({
    mutationOptions: { retry: false },
  });
  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await ResultAsync.fromPromise(
      mutateAsync({
        dataProviderName: "execution",
        resource: "artifact-download",
        values: { id: artifact.artifactId },
      }),
      (cause) => (cause instanceof Error ? cause.message : "文件读取失败"),
    );
    setBusy(false);
    if (result.isErr()) setError(result.error);
    else platform.downloadBlob(result.value.data.blob, result.value.data.name);
  };

  return (
    <div className="space-y-1 rounded-lg border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-all">{artifact.name}</span>
        <Button disabled={busy} size="sm" variant="outline" onClick={handleDownload}>
          {busy ? "校验中…" : "下载"}
        </Button>
      </div>
      <p className="break-all text-[10px] text-muted-foreground">
        {artifact.sizeBytes} bytes · SHA-256 {artifact.sha256}
      </p>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
