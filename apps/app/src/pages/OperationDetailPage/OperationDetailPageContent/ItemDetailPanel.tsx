import Markdown from "react-markdown";
import { LayoutTemplate } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useDataProvider, useOne } from "@refinedev/core";
import type { Operation, OperationOutputItemTemplate } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/pipelines.operations.$operationId.index";
import { useOperationDetailPageStore } from "../_store";
import { TemplateContentView } from "./TemplateContentView";

export const ItemDetailPanel = () => {
  const { t } = useTranslation();
  const { operationId } = Route.useParams();
  const getDataProvider = useDataProvider();
  const { result: operation } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });

  const store = useOperationDetailPageStore();
  const {
    selectedItemIndex,
    activeTab,
    selectedTemplateIndex,
    templates,
    handleDefinitionTabButtonClick,
    handleTemplatesTabButtonClick,
    handleTemplateItemClick,
  } = useStore(
    store,
    useShallow((s) => ({
      selectedItemIndex: s.selectedItemIndex,
      activeTab: s.activeTab,
      selectedTemplateIndex: s.selectedTemplateIndex,
      templates: s.templates,
      handleDefinitionTabButtonClick: s.handleDefinitionTabButtonClick,
      handleTemplatesTabButtonClick: s.handleTemplatesTabButtonClick,
      handleTemplateItemClick: s.handleTemplateItemClick,
    })),
  );

  const outputs = Array.isArray(operation?.config.outputs) ? operation.config.outputs : [];
  const selectedItem = outputs[selectedItemIndex];

  if (!selectedItem) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">{t("operations.noOutputItems")}</p>
      </div>
    );
  }

  const templateIds = selectedItem.templateIds ?? [];
  const handleTemplatesTabClick = () => {
    const dataProvider = getDataProvider();
    handleTemplatesTabButtonClick(templateIds, {
      fetchTemplate: async (templateId) => {
        const result = await dataProvider.getOne!<OperationOutputItemTemplate>({
          resource: ResourceName.operationOutputItemTemplates,
          id: templateId,
        });

        return result.data ?? null;
      },
    });
  };

  return (
    <div className="p-5">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        <Button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium",
            activeTab === "definition"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          variant="ghost"
          onClick={handleDefinitionTabButtonClick}
        >
          {t("operations.definition")}
        </Button>
        <Button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium",
            activeTab === "templates"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          variant="ghost"
          onClick={handleTemplatesTabClick}
        >
          <span className="flex items-center justify-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates ({templateIds.length})
          </span>
        </Button>
      </div>

      {/* Tab content */}
      {activeTab === "definition" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-sm font-semibold text-foreground">
                {selectedItem.name}
              </span>
              <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {selectedItem.contentType}
              </span>
            </div>
            {selectedItem.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <Markdown>{selectedItem.description}</Markdown>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templateIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
              <LayoutTemplate className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">{t("operations.noTemplates")}</p>
            </div>
          ) : (
            <>
              {/* Template sub-tabs */}
              <div className="flex gap-1 border-b border-border pb-2">
                {templateIds.map((templateId, idx) => {
                  const tpl = templates[templateId];

                  return (
                    <Button
                      key={templateId}
                      className={cn(
                        "rounded-t-md px-3 py-1.5 text-xs font-medium",
                        idx === selectedTemplateIndex
                          ? "border-b-2 border-primary text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      variant="ghost"
                      onClick={handleTemplateItemClick.bind(null, idx)}
                    >
                      {tpl?.name ?? templateId}
                    </Button>
                  );
                })}
              </div>

              {/* Selected template content */}
              {(() => {
                const activeTemplateId = templateIds[selectedTemplateIndex];
                if (!activeTemplateId) {
                  return (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    </div>
                  );
                }

                return <TemplateContentView templateId={activeTemplateId} />;
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
};
