import { Folder } from "lucide-react";
import type { FolderObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface FolderNodeProps {
  data: FolderObjectNodeData;
  id: string;
  selected?: boolean;
}

export const FolderNode = ({ data, id, selected }: FolderNodeProps) => (
  <GNodeShell
    rightHandle
    detail={data.disclosureMode ?? "Folder input"}
    icon={Folder}
    id={id}
    kind="Folder"
    selected={selected}
    theme="amber"
    title={data.label}
  >
    <GNodeCodeLine>{data.folderPath || "No folder selected"}</GNodeCodeLine>
    {data.includedExtensions?.length ? (
      <GNodeMetaLine>{data.includedExtensions.join(", ")}</GNodeMetaLine>
    ) : null}
  </GNodeShell>
);
