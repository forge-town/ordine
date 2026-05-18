import { FileOutput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useOne } from "@refinedev/core";
import type { Operation } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/pipelines.operations.$operationId.index";
import { useOperationDetailPageStore } from "../_store";

export const OutputItemsPanel = () => {
  const { t } = useTranslation();
  const { operationId } = Route.useParams();
  const { result: operation } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });

  const store = useOperationDetailPageStore();
  const selectedItemIndex = useStore(store, (s) => s.selectedItemIndex);
  const handleOutputItemRowClick = useStore(store, (s) => s.handleOutputItemRowClick);

  const outputs = Array.isArray(operation?.config.outputs) ? operation.config.outputs : [];

  return (
    <div className="w-56 shrink-0 border-r border-border overflow-y-auto bg-muted/30">
      <div className="p-3">
        <h3 className="flex items-center gap-1.5 px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileOutput className="h-3.5 w-3.5" />
          {t("operations.outputItems")}
        </h3>
        {outputs.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">{t("operations.noOutputItems")}</p>
        ) : (
          <div className="space-y-0.5">
            {outputs.map((item, index) => (
              <Button
                key={item.name}
                className={cn(
                  "flex h-auto w-full flex-col items-stretch gap-0 rounded-md px-2.5 py-2 text-left text-xs",
                  index === selectedItemIndex
                    ? "bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                    : "text-foreground",
                )}
                variant="ghost"
                onClick={handleOutputItemRowClick.bind(null, index)}
              >
                <span className="block truncate font-mono">{item.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {item.contentType}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
