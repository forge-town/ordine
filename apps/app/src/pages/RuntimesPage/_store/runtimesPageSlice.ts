import type { StateCreator } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";
import type { RuntimesState } from "./runtimesStore";

export interface DetectedRuntime {
  type: string;
  binaryName: string;
  path: string;
  version?: string;
}

export interface RuntimesPageSlice {
  runtimes: AgentRuntimeConfig[];
  selectedId: string;
  saved: boolean;
  deleteConfirm: boolean;

  handleSetRuntimes: (runtimes: AgentRuntimeConfig[]) => void;
  handleSelectRuntime: (id: string) => void;
  handleAddRuntime: () => void;
  handleUpdateRuntime: (id: string, patch: Partial<AgentRuntimeConfig>) => void;
  handleDeleteRuntime: (id: string) => void;
  handleDeleteClick: () => void;
  handleBlurDelete: () => void;
  handleConnectionModeChange: (mode: "local" | "ssh") => void;
  handleSshFieldChange: (field: string, value: string | number) => void;
  handleSetSaved: (saved: boolean) => void;
  handleSaveComplete: () => void;
  handleScanComplete: (detected: DetectedRuntime[]) => void;
}

export const createRuntimesPageSlice =
  (initial: AgentRuntimeConfig[]): StateCreator<RuntimesState> =>
  (set, get) => ({
    runtimes: initial,
    selectedId: initial[0]?.id ?? "",
    saved: false,
    deleteConfirm: false,

    handleSetRuntimes: (runtimes) => set({ runtimes }),

    handleSelectRuntime: (id) => set({ selectedId: id }),

    handleAddRuntime: () => {
      const runtime: AgentRuntimeConfig = {
        id: crypto.randomUUID(),
        name: "",
        type: "claude-code",
        connection: { mode: "local" },
      };
      set((state) => ({
        runtimes: [...state.runtimes, runtime],
        selectedId: runtime.id,
        saved: false,
      }));
    },

    handleUpdateRuntime: (id, patch) =>
      set((state) => ({
        runtimes: state.runtimes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        saved: false,
      })),

    handleDeleteRuntime: (id) =>
      set((state) => {
        const next = state.runtimes.filter((r) => r.id !== id);

        return {
          runtimes: next,
          selectedId: state.selectedId === id ? (next[0]?.id ?? "") : state.selectedId,
          saved: false,
        };
      }),

    handleDeleteClick: () => {
      const { deleteConfirm, selectedId } = get();
      if (!deleteConfirm) {
        set({ deleteConfirm: true });

        return;
      }
      const next = get().runtimes.filter((r) => r.id !== selectedId);
      set({
        runtimes: next,
        selectedId: get().selectedId === selectedId ? (next[0]?.id ?? "") : get().selectedId,
        saved: false,
        deleteConfirm: false,
      });
    },

    handleBlurDelete: () => set({ deleteConfirm: false }),

    handleConnectionModeChange: (mode) => {
      const { selectedId } = get();
      set((state) => ({
        runtimes: state.runtimes.map((r) =>
          r.id === selectedId
            ? {
                ...r,
                connection:
                  mode === "local"
                    ? { mode: "local" as const }
                    : { mode: "ssh" as const, host: "", user: "" },
              }
            : r
        ),
        saved: false,
      }));
    },

    handleSshFieldChange: (field, value) => {
      const { selectedId } = get();
      set((state) => ({
        runtimes: state.runtimes.map((r) => {
          if (r.id !== selectedId || r.connection.mode !== "ssh") return r;

          return {
            ...r,
            connection: { ...r.connection, [field]: value || undefined },
          };
        }),
        saved: false,
      }));
    },

    handleSetSaved: (saved) => set({ saved }),

    handleSaveComplete: () => {
      set({ saved: true });
      setTimeout(() => set({ saved: false }), 2000);
    },

    handleScanComplete: (detected) => {
      const { runtimes } = get();
      const existingTypes = new Set(runtimes.map((r) => r.type));
      const newRuntimes: AgentRuntimeConfig[] = detected
        .filter((d) => !existingTypes.has(d.type as AgentRuntimeConfig["type"]))
        .map((d) => ({
          id: crypto.randomUUID(),
          name: d.version ? `${d.binaryName} (${d.version})` : d.binaryName,
          type: d.type as AgentRuntimeConfig["type"],
          connection: { mode: "local" as const },
        }));

      if (newRuntimes.length > 0) {
        set({
          runtimes: [...runtimes, ...newRuntimes],
          selectedId: newRuntimes[0]!.id,
          saved: false,
        });
      }
    },
  });
