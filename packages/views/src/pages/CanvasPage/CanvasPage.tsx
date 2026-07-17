import { useOne } from "@refinedev/core";
import type { PipelineData } from "@repo/schemas";
import { CanvasLayout } from "../../components/CanvasLayout";
import { PageLoadingState } from "../../components/PageLoadingState";
import { ResourceName } from "../../constants";
import { CanvasPageStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";

interface CanvasPageProps {
  // Pipeline id to load, read from the route's search params by each app.
  id?: string;
}

export const CanvasPage = ({ id }: CanvasPageProps) => {
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
      <CanvasPageStoreProvider pipeline={pipeline}>
        <CanvasPageContent />
      </CanvasPageStoreProvider>
    </CanvasLayout>
  );
};
