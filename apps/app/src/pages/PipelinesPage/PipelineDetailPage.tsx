import { AppLayout } from "@/components/AppLayout";
import { PipelineDetailPageContent } from "./PipelineDetailPageContent";
import { Route } from "@/routes/pipelines.$pipelineId";

export const PipelineDetailPage = () => {
  const { pipeline, operations } = Route.useLoaderData();

  if (!pipeline) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Pipeline 不存在</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PipelineDetailPageContent operations={operations} pipeline={pipeline} />
    </AppLayout>
  );
};
