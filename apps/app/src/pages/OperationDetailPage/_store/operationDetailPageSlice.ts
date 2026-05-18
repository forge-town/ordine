import type { StateCreator } from "zustand";
import type { OperationOutputItemTemplate } from "@repo/schemas";
import { ResultAsync } from "neverthrow";

export interface OperationDetailDependencies {
  fetchTemplate: (templateId: string) => Promise<OperationOutputItemTemplate | null>;
  navigateBack: () => void;
  navigateToEdit: (operationId: string) => void;
}

export interface OperationDetailPageSlice {
  selectedItemIndex: number;
  activeTab: "definition" | "templates";
  selectedTemplateIndex: number;
  templates: Record<string, OperationOutputItemTemplate>;
  templateViewMode: "raw" | "preview";

  handleOutputItemRowClick: (index: number) => void;
  handleDefinitionTabButtonClick: () => void;
  handleTemplatesTabButtonClick: (
    templateIds: string[],
    dependencies: Pick<OperationDetailDependencies, "fetchTemplate">,
  ) => void;
  handleTemplateItemClick: (index: number) => void;
  handleBackLinkClick: (dependencies: Pick<OperationDetailDependencies, "navigateBack">) => void;
  handleEditButtonClick: (
    operationId: string,
    dependencies: Pick<OperationDetailDependencies, "navigateToEdit">,
  ) => void;
  handleTemplateViewModeButtonClick: (mode: "raw" | "preview") => void;
}

export const createOperationDetailPageSlice: StateCreator<OperationDetailPageSlice> = (
  set,
  get,
) => {
  const fetchTemplates = (
    templateIds: string[],
    dependencies: Pick<OperationDetailDependencies, "fetchTemplate">,
  ) => {
    const { templates } = get();
    const idsToFetch = templateIds.filter((id) => !templates[id]);
    if (idsToFetch.length === 0) return;

    for (const id of idsToFetch) {
      void ResultAsync.fromPromise(dependencies.fetchTemplate(id), () => null).match(
        (template) => {
          if (template) {
            set((state) => ({
              templates: { ...state.templates, [id]: template },
            }));
          }
        },
        () => undefined,
      );
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

    handleTemplatesTabButtonClick: (templateIds, dependencies) => {
      set({ activeTab: "templates" });
      fetchTemplates(templateIds, dependencies);
    },

    handleTemplateItemClick: (index) => set({ selectedTemplateIndex: index }),

    handleBackLinkClick: (dependencies) => {
      dependencies.navigateBack();
    },

    handleEditButtonClick: (operationId, dependencies) => {
      dependencies.navigateToEdit(operationId);
    },

    handleTemplateViewModeButtonClick: (mode) => set({ templateViewMode: mode }),
  };
};
