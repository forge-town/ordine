import { FileCode } from "lucide-react";
import type { FileObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface FileNodeProps {
  data: FileObjectNodeData;
  id: string;
  selected?: boolean;
}

export const FileNode = ({ data, id, selected }: FileNodeProps) => (
  <GNodeShell
    rightHandle
    detail={data.language ?? "File input"}
    icon={FileCode}
    id={id}
    kind="File"
    selected={selected}
    theme="orange"
    title={data.label}
  >
    <GNodeCodeLine>{data.filePath || "No file selected"}</GNodeCodeLine>
    {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
  </GNodeShell>
);
