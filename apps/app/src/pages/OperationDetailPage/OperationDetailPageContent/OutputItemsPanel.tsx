import { FileOutput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { OutputItem } from "@repo/schemas";
import { useOperationDetailPageStore } from "../_store";

interface OutputItemsPanelProps {
  outputs: OutputItem[];
}

export const OutputItemsPanel = ({ outputs }: OutputItemsPanelProps) => {
  const { t } = useTranslation();

  const store = useOperationDetailPageStore();
  const { selectedItemIndex, handleSelectItem } = useStore(
    store,
    useShallow((s) => ({
      selectedItemIndex: s.selectedItemIndex,
      handleSelectItem: s.handleSelectItem,
    }))
  );

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
              <button
                key={item.name}
                className={`w-full rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  index === selectedItemIndex
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
                onClick={handleSelectItem.bind(null, index)}
              >
                <span className="block truncate font-mono">{item.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {item.kind}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
