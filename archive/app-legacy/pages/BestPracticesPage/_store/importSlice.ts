import type { StateCreator } from "zustand";
import type { previewBestPracticesImport, ParsedBestPractice } from "@/lib/exportBestPractice";

export type ImportPreviewData = Awaited<ReturnType<typeof previewBestPracticesImport>>;

export interface ImportSlice {
  importPreview: ImportPreviewData | null;
  pendingEntries: ParsedBestPractice[] | null;
  importLoading: boolean;

  handleSetImportPreview: (preview: ImportPreviewData | null) => void;
  handleSetPendingEntries: (entries: ParsedBestPractice[] | null) => void;
  handleSetImportLoading: (loading: boolean) => void;
  handleResetImport: () => void;
}

export const createImportSlice: StateCreator<ImportSlice> = (set) => ({
  importPreview: null,
  pendingEntries: null,
  importLoading: false,

  handleSetImportPreview: (preview) => set({ importPreview: preview }),
  handleSetPendingEntries: (entries) => set({ pendingEntries: entries }),
  handleSetImportLoading: (loading) => set({ importLoading: loading }),
  handleResetImport: () => set({ importPreview: null, pendingEntries: null, importLoading: false }),
});
