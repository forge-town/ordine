import { useOne } from "@refinedev/core";
import type { PipelineData } from "@repo/schemas";
import { CanvasLayout } from "../../components/CanvasLayout";
import { PageLoadingState } from "../../components/PageLoadingState";
import { ResourceName } from "../../constants";
import { CanvasPageStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { RunStateRestorer } from "./RunConsole/RunStateRestorer";
import { CanvasRunEventSynchronizer } from "./RunConsole/CanvasRunEventSynchronizer";

interface CanvasPageProps {
  // Pipeline id to load, read from the route's search params by each app.
  id?: string;
  embedded?: boolean;
  showCanvasMiniSidebar?: boolean;
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
}

export const CanvasPage = ({
  embedded = false,
  id,
  onGeneratedPipeline: handleGeneratedPipeline,
  showCanvasMiniSidebar = true,
}: CanvasPageProps) => {
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;

  if (id && pipelineQuery?.isLoading) {
    return (
      <CanvasLayout embedded={embedded}>
        <PageLoadingState variant="detail" />
      </CanvasLayout>
    );
  }

  return (
    <CanvasLayout embedded={embedded}>
      <CanvasPageStoreProvider pipeline={pipeline}>
        <RunStateRestorer />
        <CanvasRunEventSynchronizer />
        <CanvasPageContent
          showCanvasMiniSidebar={showCanvasMiniSidebar}
          onGeneratedPipeline={handleGeneratedPipeline}
        />
      </CanvasPageStoreProvider>
    </CanvasLayout>
  );
};
