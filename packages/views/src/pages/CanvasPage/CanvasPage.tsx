import { useOne } from "@refinedev/core";
import type { PipelineData } from "@repo/schemas";
import { CanvasLayout } from "../../components/CanvasLayout";
import { PageLoadingState } from "../../components/PageLoadingState";
import { ResourceName } from "../../constants";
import { CanvasPageStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { CanvasAgentControlBridge } from "./AgentControlBridge";
import { PageState } from "../../components/PageState";
import { Button } from "@repo/ui/button";
import { CanvasPublishedPipeline } from "./CanvasPublishedPipeline";
import { isAuthoringPipelineMissing } from "./canvasAuthoringState";

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
    queryOptions: { enabled: !!id, retry: false },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;

  if (id && (pipelineQuery?.isLoading || pipelineQuery?.isPending)) {
    return (
      <CanvasLayout embedded={embedded}>
        <PageLoadingState variant="detail" />
      </CanvasLayout>
    );
  }

  if (
    id &&
    isAuthoringPipelineMissing({
      error: pipelineQuery?.error,
      isSuccess: pipelineQuery?.isSuccess,
      result: pipelineResult,
      responseData: pipelineQuery?.data?.data,
    })
  )
    return (
      <CanvasLayout embedded={embedded}>
        <CanvasPublishedPipeline id={id} />
      </CanvasLayout>
    );
  if (id && (!pipeline || pipelineQuery?.error))
    return (
      <CanvasLayout embedded={embedded}>
        <div className="p-4">
          <PageState
            title="无法读取作者草稿"
            description={pipelineQuery?.error?.message ?? "服务器没有明确返回草稿记录，请重试。"}
            action={
              <Button variant="outline" onClick={() => void pipelineQuery.refetch()}>
                重试读取
              </Button>
            }
          />
        </div>
      </CanvasLayout>
    );

  return (
    <CanvasLayout embedded={embedded}>
      <CanvasPageStoreProvider pipeline={pipeline}>
        <CanvasAgentControlBridge />
        <CanvasPageContent
          showCanvasMiniSidebar={showCanvasMiniSidebar}
          onGeneratedPipeline={handleGeneratedPipeline}
        />
      </CanvasPageStoreProvider>
    </CanvasLayout>
  );
};
