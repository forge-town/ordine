import { Activity } from "lucide-react";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import type { NodeConfigSectionProps } from "./types";

export const LastRunSection = ({ node }: NodeConfigSectionProps) => {
  const store = useCanvasPageStore();
  const runStatus = useStore(store, (state) => state.nodeRunStatuses[node.id]);
  const llmContent = useStore(store, (state) => state.nodeLlmContent[node.id]);
  const status = runStatus ?? ("status" in node.data ? node.data.status : "idle");

  return (
    <section className="space-y-2 rounded-lg bg-background p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold">Last run</h3>
      </div>
      <div className="grid grid-cols-[72px_1fr] gap-2 text-[12px]">
        <span className="text-muted-foreground">Status</span>
        <span className="font-mono">{String(status ?? "idle")}</span>
        <span className="text-muted-foreground">Output</span>
        <span className="truncate">{llmContent || "No run output yet."}</span>
      </div>
    </section>
  );
};
