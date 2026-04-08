import { PipelineDetailPageContent } from "./PipelineDetailPageContent";
import { Route } from "@/routes/_layout/pipelines.$pipelineId";

export const PipelineDetailPage = () => {
  const { pipeline, operations } = Route.useLoaderData();

  if (!pipeline) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Pipeline 不存在</p>
      </div>
    );
  }

  return (
    <PipelineDetailPageContent operations={operations} pipeline={pipeline} />
  );
};
