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

  handleSelectItem: (index: number) => void;
  handleSetActiveTab: (tab: "definition" | "templates") => void;
  handleSelectTemplate: (index: number) => void;
  handleFetchTemplates: (templateIds: string[]) => void;
  handleNavigateBack: () => void;
  handleNavigateToEdit: (operationId: string) => void;
  handleSwitchToTemplatesTab: (templateIds: string[]) => void;
  handleSetTemplateViewMode: (mode: "raw" | "preview") => void;
}

export const createOperationDetailPageSlice: StateCreator<OperationDetailPageSlice> = (
  set,
  get
) => ({
  selectedItemIndex: 0,
  activeTab: "definition",
  selectedTemplateIndex: 0,
  templates: {},
  templateViewMode: "raw",

  handleSelectItem: (index) =>
    set({ selectedItemIndex: index, activeTab: "definition", selectedTemplateIndex: 0 }),

  handleSetActiveTab: (tab) => set({ activeTab: tab }),

  handleSelectTemplate: (index) => set({ selectedTemplateIndex: index }),

  handleFetchTemplates: (templateIds) => {
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
  },

  handleNavigateBack: () => {
    void router.navigate({ to: "/pipelines/operations" });
  },

  handleNavigateToEdit: (operationId) => {
    void router.navigate({
      to: "/pipelines/operations/$operationId/edit",
      params: { operationId },
    });
  },

  handleSwitchToTemplatesTab: (templateIds) => {
    set({ activeTab: "templates" });
    get().handleFetchTemplates(templateIds);
  },

  handleSetTemplateViewMode: (mode) => set({ templateViewMode: mode }),
});
