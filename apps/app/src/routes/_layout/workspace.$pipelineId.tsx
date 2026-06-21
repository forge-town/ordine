import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/pages/WorkspacePage";

const WorkspaceRoute = () => {
  const { pipelineId } = Route.useParams();

  return <WorkspacePage pipelineId={pipelineId} />;
};

export const Route = createFileRoute("/_layout/workspace/$pipelineId")({
  head: () => ({
    meta: [{ title: "Workspace | Ordine" }],
  }),
  component: WorkspaceRoute,
});
