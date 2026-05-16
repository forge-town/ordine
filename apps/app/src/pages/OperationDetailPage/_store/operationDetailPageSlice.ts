import type { StateCreator } from "zustand";
import type { OperationOutputItemTemplate } from "@repo/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { router } from "@/router";

export interface OperationDetailPageSlice {
  selectedItemIndex: number;
  activeTab: "definition" | "templates";
  selectedTemplateIndex: number;
  templates: Record<string, OperationOutputItemTemplate>;
  templateViewMode: "raw" | "preview";

  handleOutputItemRowClick: (index: number) => void;
  handleDefinitionTabButtonClick: () => void;
  handleTemplatesTabButtonClick: (templateIds: string[]) => void;
  handleTemplateItemClick: (index: number) => void;
  handleBackLinkClick: () => void;
  handleEditButtonClick: (operationId: string) => void;
  handleTemplateViewModeButtonClick: (mode: "raw" | "preview") => void;
}

export const createOperationDetailPageSlice: StateCreator<OperationDetailPageSlice> = (
  set,
  get,
) => {
  const fetchTemplates = (templateIds: string[]) => {
    const { templates } = get();
    const idsToFetch = templateIds.filter((id) => !templates[id]);
    if (idsToFetch.length === 0) return;

    for (const id of idsToFetch) {
      dataProvider
        .getOne<OperationOutputItemTemplate>({
          resource: ResourceName.operationOutputItemTemplates,
          id,
        })
        .then(({ data }) => {
          if (data) {
            set((state) => ({
              templates: { ...state.templates, [id]: data },
            }));
          }
        })
        .catch(() => {
          /* template not found — ignore */
        });
    }
  };

  return {
    selectedItemIndex: 0,
    activeTab: "definition",
    selectedTemplateIndex: 0,
    templates: {},
    templateViewMode: "raw",

    handleOutputItemRowClick: (index) =>
      set({ selectedItemIndex: index, activeTab: "definition", selectedTemplateIndex: 0 }),

    handleDefinitionTabButtonClick: () => set({ activeTab: "definition" }),

    handleTemplatesTabButtonClick: (templateIds) => {
      set({ activeTab: "templates" });
      fetchTemplates(templateIds);
    },

    handleTemplateItemClick: (index) => set({ selectedTemplateIndex: index }),

    handleBackLinkClick: () => {
      void router.navigate({ to: "/pipelines/operations" });
    },

    handleEditButtonClick: (operationId) => {
      void router.navigate({
        to: "/pipelines/operations/$operationId/edit",
        params: { operationId },
      });
    },

    handleTemplateViewModeButtonClick: (mode) => set({ templateViewMode: mode }),
  };
};
