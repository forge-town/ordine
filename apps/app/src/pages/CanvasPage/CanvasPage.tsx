import { useOne } from "@refinedev/core";
import type { PipelineData } from "@repo/schemas";
import { CanvasLayout } from "@/components/CanvasLayout";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/canvas";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";

export const CanvasPage = () => {
  const { id } = Route.useSearch();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;

  if (id && pipelineQuery?.isLoading) {
    return (
      <CanvasLayout>
        <PageLoadingState variant="detail" />
      </CanvasLayout>
    );
  }

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider pipeline={pipeline}>
        <CanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
