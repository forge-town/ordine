import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/primitives";

const JobsIndexRoute = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        eyebrow="Monitor"
        icon={<Icon className="text-muted-foreground" icon={ListChecks} size={18} />}
        sub="Recent runs, queued work, and execution outcomes."
        title="Jobs"
      />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <Icon className="text-muted-foreground" icon={ListChecks} size={18} />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No jobs selected</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Job records will appear here in the page buildout.
          </p>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_layout/jobs/")({
  head: () => ({
    meta: [{ title: "Jobs | Ordine" }],
  }),
  component: JobsIndexRoute,
});
