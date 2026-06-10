import { createFileRoute, Link } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { buttonVariants } from "@repo/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/primitives";

const PipelinesIndexRoute = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ size: "sm" })}
            params={{ pipelineId: "demo" }}
            to="/workspace/$pipelineId"
          >
            Open Workspace
          </Link>
        }
        eyebrow="Assembly"
        icon={<Icon className="text-muted-foreground" icon={Workflow} size={18} />}
        sub="Draft, review, and run agent pipelines from one workspace."
        title="Pipelines"
      />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <Icon className="text-muted-foreground" icon={Workflow} size={18} />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No pipelines selected</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Pipeline records will appear here after the workspace routes are connected.
          </p>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_layout/pipelines/")({
  head: () => ({
    meta: [{ title: "Pipelines | Ordine" }],
  }),
  component: PipelinesIndexRoute,
});
