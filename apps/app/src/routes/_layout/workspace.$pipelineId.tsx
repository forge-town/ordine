import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Icon, Tag } from "@/components/primitives";

const WorkspaceRoute = () => {
  const { pipelineId } = Route.useParams();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        badge={<Tag>{pipelineId}</Tag>}
        eyebrow="Workspace"
        icon={<Icon className="text-muted-foreground" icon={Workflow} size={18} />}
        sub="Canvas and agent bar layout will land in the workspace skeleton task."
        title="Pipeline Workspace"
      />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
        <div className="canvas-grid flex items-center justify-center border-r border-border">
          <div className="rounded-xl bg-surface px-4 py-3 text-[12.5px] text-muted-foreground shadow-soft ring-1 ring-border">
            Canvas placeholder
          </div>
        </div>
        <aside className="flex items-center justify-center bg-surface">
          <div className="text-[12.5px] text-muted-foreground">Agent Bar placeholder</div>
        </aside>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_layout/workspace/$pipelineId")({
  head: () => ({
    meta: [{ title: "Workspace | Ordine" }],
  }),
  component: WorkspaceRoute,
});
