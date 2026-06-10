import { AtSign, X } from "lucide-react";
import type { WorkspaceCanvasRef } from "../../_store/workspaceStore";
import { Icon } from "@/components/primitives";

export type RefTagBarProps = {
  refs: WorkspaceCanvasRef[];
  onRemoveRef: (id: string) => void;
};

export const RefTagBar = ({ onRemoveRef, refs }: RefTagBarProps) => {
  if (refs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
      {refs.map((ref) => {
        const handleRemoveClick = () => onRemoveRef(ref.id);

        return (
          <span
            key={ref.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium"
          >
            <Icon icon={AtSign} size={9} />
            <span className="truncate">{ref.label}</span>
            <button
              aria-label={`Remove ${ref.label}`}
              className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              type="button"
              onClick={handleRemoveClick}
            >
              <Icon icon={X} size={9} />
            </button>
          </span>
        );
      })}
    </div>
  );
};
