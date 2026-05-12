import Markdown from "react-markdown";
import { LayoutTemplate } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { OutputItem } from "@repo/schemas";
import { useOperationDetailPageStore } from "../_store";
import { TemplateContentView } from "./TemplateContentView";

interface ItemDetailPanelProps {
  selectedItem: OutputItem | undefined;
}

export const ItemDetailPanel = ({ selectedItem }: ItemDetailPanelProps) => {
  const { t } = useTranslation();

  const store = useOperationDetailPageStore();
  const {
    activeTab,
    selectedTemplateIndex,
    templates,
    handleSetActiveTab,
    handleSwitchToTemplatesTab,
    handleSelectTemplate,
  } = useStore(
    store,
    useShallow((s) => ({
      activeTab: s.activeTab,
      selectedTemplateIndex: s.selectedTemplateIndex,
      templates: s.templates,
      handleSetActiveTab: s.handleSetActiveTab,
      handleSwitchToTemplatesTab: s.handleSwitchToTemplatesTab,
      handleSelectTemplate: s.handleSelectTemplate,
    }))
  );

  if (!selectedItem) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">{t("operations.noOutputItems")}</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "definition"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={handleSetActiveTab.bind(null, "definition")}
        >
          {t("operations.definition")}
        </button>
        <button
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "templates"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={handleSwitchToTemplatesTab.bind(null, selectedItem.templateIds)}
        >
          <span className="flex items-center justify-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates ({selectedItem.templateIds.length})
          </span>
        </button>
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
                {selectedItem.kind}
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
          {selectedItem.templateIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
              <LayoutTemplate className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">{t("operations.noTemplates")}</p>
            </div>
          ) : (
            <>
              {/* Template sub-tabs */}
              <div className="flex gap-1 border-b border-border pb-2">
                {selectedItem.templateIds.map((templateId, idx) => {
                  const tpl = templates[templateId];

                  return (
                    <button
                      key={templateId}
                      className={`rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        idx === selectedTemplateIndex
                          ? "border-b-2 border-primary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={handleSelectTemplate.bind(null, idx)}
                    >
                      {tpl?.name ?? templateId}
                    </button>
                  );
                })}
              </div>

              {/* Selected template content */}
              {(() => {
                const activeTemplateId = selectedItem.templateIds[selectedTemplateIndex];
                const tpl = activeTemplateId ? templates[activeTemplateId] : undefined;
                if (!tpl) {
                  return (
                    <div className="flex items-center justify-center py-8">
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    </div>
                  );
                }

                return <TemplateContentView template={tpl} />;
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
};
