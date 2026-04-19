import { PipelineDetailPageContent } from "./PipelineDetailPageContent";
import { Route } from "@/routes/_layout/pipelines.$pipelineId";
import { useOne, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { PipelineEntity } from "@repo/models";
import type { OperationRecord } from "@repo/db-schema";
import { PageLoadingState } from "@/components/PageLoadingState";

export const PipelineDetailPage = () => {
  const { pipelineId } = Route.useParams();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineEntity>({
    resource: ResourceName.pipelines,
    id: pipelineId,
  });
  const { result: operationsResult, query: operationsQuery } = useList<OperationRecord>({
    resource: ResourceName.operations,
  });
  const pipeline = pipelineResult ?? null;
  const operations = operationsResult?.data ?? [];

  if (pipelineQuery?.isLoading || operationsQuery?.isLoading) {
    return <PageLoadingState title="Pipeline" variant="detail" />;
  }

  if (!pipeline) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Pipeline 不存在</p>
      </div>
    );
  }

  return <PipelineDetailPageContent operations={operations} pipeline={pipeline} />;
};
