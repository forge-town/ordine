import { createFileRoute } from "@tanstack/react-router";
import { Cpu } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/primitives";

const LocalAgentsRoute = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        eyebrow="Capabilities"
        icon={<Icon className="text-muted-foreground" icon={Cpu} size={18} />}
        sub="Local model and agent runtime capacity."
        title="Local Agents"
      />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <Icon className="text-muted-foreground" icon={Cpu} size={18} />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No agent selected</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Local agent records will appear here in the page buildout.
          </p>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_layout/local-agents")({
  head: () => ({
    meta: [{ title: "Local Agents | Ordine" }],
  }),
  component: LocalAgentsRoute,
});
