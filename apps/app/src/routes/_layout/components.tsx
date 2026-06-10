import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/primitives";

const ComponentsRoute = () => {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <PageHeader
        eyebrow="Assembly"
        icon={<Icon className="text-muted-foreground" icon={Boxes} size={18} />}
        sub="Reusable pipeline components and operation blocks."
        title="Components"
      />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <Icon className="text-muted-foreground" icon={Boxes} size={18} />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No components selected</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Component records will appear here in the page buildout.
          </p>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/_layout/components")({
  head: () => ({
    meta: [{ title: "Components | Ordine" }],
  }),
  component: ComponentsRoute,
});
