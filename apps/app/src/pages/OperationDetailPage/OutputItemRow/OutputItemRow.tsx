import { type FC } from "react";
import { useOne } from "@refinedev/core";
import type { Operation } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/pipelines.operations.$operationId.index";

interface OutputItemRowProps {
  itemIndex: number;
}

export const OutputItemRow: FC<OutputItemRowProps> = ({ itemIndex }) => {
  const { operationId } = Route.useParams();
  const { result: operation } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });

  const outputs = Array.isArray(operation?.config.outputs) ? operation.config.outputs : [];
  const item = outputs[itemIndex];
  if (!item) return null;

  return (
    <div className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-foreground">{item.name}</span>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {item.contentType}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );
};
