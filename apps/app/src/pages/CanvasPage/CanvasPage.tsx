import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { Route } from "@/routes/canvas";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { StoredPipeline } from "@repo/models";

export const CanvasPage = () => {
  const { id } = Route.useSearch();
  const { result: pipelineResult } = useOne<StoredPipeline>({
    resource: ResourceName.pipelines,
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider pipeline={pipeline}>
        <CanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
