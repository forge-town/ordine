import { useOne } from "@refinedev/core";
import type { ExecutionInputAsset } from "@repo/schemas";
export const InputAssetDetails = ({
  id,
  dataProviderName,
}: {
  id: string;
  dataProviderName?: string;
}) => {
  const { result, query } = useOne<ExecutionInputAsset>({
    dataProviderName,
    resource: "artifacts",
    id,
    queryOptions: { enabled: Boolean(id), retry: false },
  });

  return (
    <div className="break-all text-xs text-muted-foreground">
      {query.isLoading ? (
        "读取文件指纹…"
      ) : query.error ? (
        `文件不可读：${query.error.message}`
      ) : result ? (
        <>
          <div>
            {result.name} · {result.sizeBytes} bytes
          </div>
          <div>SHA-256 {result.sha256}</div>
        </>
      ) : null}
    </div>
  );
};
