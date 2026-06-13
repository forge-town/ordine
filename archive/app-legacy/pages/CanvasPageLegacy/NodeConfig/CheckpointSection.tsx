import { CheckCircle2 } from "lucide-react";
import type { NodeConfigSectionProps } from "./types";

export const CheckpointSection = ({ node, onPatch }: NodeConfigSectionProps) => {
  const checked = node.data.nodeType === "operation" ? Boolean(node.data.checkpoint) : false;
  const handleCheckpointChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPatch({ checkpoint: event.target.checked });
  };

  return (
    <section className="space-y-2 rounded-lg bg-background p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold">Checkpoint</h3>
      </div>
      <label className="flex items-center gap-2 text-[12px]">
        <input
          checked={checked}
          className="h-3.5 w-3.5 accent-foreground"
          disabled={node.data.nodeType !== "operation"}
          type="checkbox"
          onChange={handleCheckpointChange}
        />
        <span>Pause after this operation for review</span>
      </label>
    </section>
  );
};
