import { Handle, Position } from "@xyflow/react";
import {
  useHarnessCanvasStore,
  type GitHubProjectNodeData,
} from "../../_store";
import { NodeCard } from "../NodeCard";
import { SiGitHubIcon } from "./SiGitHubIcon";

export interface GitHubProjectNodeProps {
  id: string;
  data: GitHubProjectNodeData;
  selected?: boolean;
}

export const GitHubProjectNode = ({
  id,
  data,
  selected,
}: GitHubProjectNodeProps) => {
  const store = useHarnessCanvasStore();
  const update = (patch: Record<string, unknown>) =>
    store.getState().updateNodeData(id, patch);
  return (
    <div className="group relative" style={{ overflow: "visible" }}>
      <NodeCard
        theme="orange"
        icon={SiGitHubIcon}
        label={data.label}
        onLabelChange={(v) => update({ label: v })}
        description="GitHub Project"
        selected={selected}
        bodyClassName="space-y-2"
      >
        <div className="flex items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1">
          <input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0"
            value={data.owner}
            onChange={(e) => update({ owner: e.target.value })}
            placeholder="owner"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <span className="text-slate-400 font-mono text-[11px] shrink-0">
            /
          </span>
          <input
            className="nodrag nopan font-mono text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none flex-1 min-w-0"
            value={data.repo}
            onChange={(e) => update({ repo: e.target.value })}
            placeholder="repo"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <input
            className="nodrag nopan w-12 shrink-0 rounded bg-orange-100 px-1 py-0.5 font-mono text-[10px] font-medium text-orange-700 focus:outline-none focus:bg-orange-50 text-right"
            value={data.branch ?? ""}
            onChange={(e) => update({ branch: e.target.value })}
            placeholder="main"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        <textarea
          className="nodrag nopan text-[11px] text-slate-500 bg-transparent w-full resize-none focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200 rounded px-1"
          rows={2}
          value={data.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="仓库描述..."
          onMouseDown={(e) => e.stopPropagation()}
        />
      </NodeCard>

      {/* Object nodes only emit connections — no target handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="absolute h-3.5 w-3.5 rounded-full bg-orange-600 border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5"
      />
    </div>
  );
};
