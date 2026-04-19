import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { Route } from "@/routes/canvas";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { PipelineRecord } from "@repo/db-schema";
import { PageLoadingState } from "@/components/PageLoadingState";

export const CanvasPage = () => {
  const { id } = Route.useSearch();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineRecord>({
    resource: ResourceName.pipelines,
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;

  if (id && pipelineQuery?.isLoading) {
    return (
      <CanvasLayout>
        <PageLoadingState title="Canvas" variant="detail" />
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
