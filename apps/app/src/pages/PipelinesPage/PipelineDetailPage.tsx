import { PipelineDetailPageContent } from "./PipelineDetailPageContent";
import { Route } from "@/routes/_layout/pipelines.$pipelineId";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { StoredPipeline, OperationEntity } from "@repo/models";

export const PipelineDetailPage = () => {
  const { pipelineId } = Route.useParams();
  const { result: pipelineResult } = useOne<StoredPipeline>({
    resource: ResourceName.pipelines,
    id: pipelineId,
  });
  const { result: operationsResult } = useList<OperationEntity>({
    resource: ResourceName.operations,
  });
  const pipeline = pipelineResult ?? null;
  const operations = operationsResult?.data ?? [];

  if (!pipeline) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Pipeline 不存在</p>
      </div>
    );
  }

  return <PipelineDetailPageContent operations={operations} pipeline={pipeline} />;
};
