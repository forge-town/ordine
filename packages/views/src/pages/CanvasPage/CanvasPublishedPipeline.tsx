import { useOne } from "@refinedev/core";
import { PipelineDefinitionSchema, type PipelineDefinition } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { PageLoadingState } from "../../components/PageLoadingState";
import { PageState } from "../../components/PageState";
import { canvasRequestStatus } from "./canvasAuthoringState";
import { CanvasPublishedPipelineContent } from "./CanvasPublishedPipelineContent";

export const CanvasPublishedPipeline = ({ id }: { id: string }) => {
  const { result, query } = useOne<PipelineDefinition>({
    dataProviderName: "execution",
    resource: "pipelines",
    id,
    queryOptions: { retry: false, refetchOnWindowFocus: false },
  });
  if (query.isLoading || query.isPending) return <PageLoadingState variant="detail" />;
  const parsed = PipelineDefinitionSchema.safeParse(result);
  if (query.error || !parsed.success || parsed.data.id !== id)
    return (
      <div className="p-4">
        <PageState
          title={
            canvasRequestStatus(query.error) === 404 || (query.isSuccess && result === null)
              ? "已发布 Pipeline 不存在"
              : "无法读取已发布 Pipeline"
          }
          description={query.error?.message ?? "服务器未返回匹配的已发布定义。"}
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              重试读取
            </Button>
          }
        />
      </div>
    );

  return (
    <CanvasPublishedPipelineContent
      key={`${parsed.data.id}:${parsed.data.revision}`}
      pipeline={parsed.data}
      onReload={() => void query.refetch()}
    />
  );
};
