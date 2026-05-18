import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import { toastStore } from "@/store/toastStore";
import i18n from "@/lib/i18n";
import { parseOperationZip } from "../importOperation";

type SortKey = "default" | "name-asc" | "name-desc" | "date-asc" | "date-desc";
export type OperationGroupKey =
  | "all"
  | "check"
  | "fix"
  | "scan"
  | "dev"
  | "scrape"
  | "eval"
  | "test"
  | "other";

type ViewMode = "grid" | "list";
type CreateResult = { data?: unknown };

export interface OperationsImportDependencies {
  createOperation: (values: Record<string, unknown>) => Promise<CreateResult>;
  createOutputTemplate: (values: Record<string, unknown>) => Promise<CreateResult>;
}

export interface OperationsPageSlice {
  searchQuery: string;
  sortBy: SortKey;
  sortOpen: boolean;
  importing: boolean;
  activeGroup: OperationGroupKey;
  viewMode: ViewMode;

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleClearSearchButtonClick: () => void;
  handleSortItemSelect: (value: string | null) => void;
  handleSortSelectOpenChange: (open: boolean) => void;
  handleSortSelectTriggerClick: () => void;
  handleImportFileInputChange: (
    event: ChangeEvent<HTMLInputElement>,
    dependencies: OperationsImportDependencies,
  ) => Promise<void>;
  handleGroupTabClick: (group: OperationGroupKey) => void;
  handleViewModeButtonClick: (mode: ViewMode) => void;
}

export const createOperationsPageSlice: StateCreator<OperationsPageSlice> = (set) => ({
  searchQuery: "",
  sortBy: "default",
  sortOpen: false,
  importing: false,
  activeGroup: "all",
  viewMode: "grid",

  handleSearchInputChange: (event) => set({ searchQuery: event.target.value }),
  handleClearSearchButtonClick: () => set({ searchQuery: "" }),
  handleSortItemSelect: (value) =>
    set({ sortBy: (value ?? "default") as SortKey, sortOpen: false }),
  handleSortSelectOpenChange: (open) => set({ sortOpen: open }),
  handleSortSelectTriggerClick: () => set((state) => ({ sortOpen: !state.sortOpen })),
  handleGroupTabClick: (group) => set({ activeGroup: group }),
  handleViewModeButtonClick: (mode) => set({ viewMode: mode }),

  handleImportFileInputChange: async (event, dependencies) => {
    const fileInput = event.target;
    const file = fileInput.files?.[0];
    if (!file) return;

    set({ importing: true });
    const addToast = toastStore.getState().addToast;

    const parseResult = await parseOperationZip(file);
    if (parseResult.isErr()) {
      addToast({
        type: "error",
        title: i18n.t("common.import"),
        description: parseResult.error,
      });
      set({ importing: false });
      fileInput.value = "";

      return;
    }
    const parsed = parseResult.value;

    const templateIdMap = new Map<string, string>();
    for (const tpl of parsed.templates) {
      const newId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      templateIdMap.set(tpl.id, newId);
      await dependencies.createOutputTemplate({
        id: newId,
        name: tpl.name,
        description: tpl.description,
        content: tpl.content,
        contentType: tpl.contentType,
      });
    }

    const outputs = parsed.config.outputs.map((o) => ({
      ...o,
      templateIds: o.templateIds.map((id) => templateIdMap.get(id) ?? id),
    }));

    const result = await dependencies.createOperation({
      id: `op-${Date.now()}`,
      name: parsed.name,
      description: parsed.description,
      config: { ...parsed.config, outputs },
      acceptedObjectTypes: parsed.acceptedObjectTypes,
    });
    const created = result.data;
    if (created) {
      addToast({
        type: "success",
        title: i18n.t("common.import"),
        description: `${i18n.t("operations.createNew")} ${parsed.name}`,
      });
    }
    set({ importing: false });
    fileInput.value = "";
  },
});
