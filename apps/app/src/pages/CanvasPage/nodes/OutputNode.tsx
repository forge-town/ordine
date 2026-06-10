import { FolderOutput, HardDriveDownload } from "lucide-react";
import type { LocalPathOutputNodeData, ProjectPathOutputNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface ProjectOutputNodeProps {
  data: ProjectPathOutputNodeData;
  id: string;
  selected?: boolean;
}

export interface LocalOutputNodeProps {
  data: LocalPathOutputNodeData;
  id: string;
  selected?: boolean;
}

export const OutputProjectPathNode = ({ data, id, selected }: ProjectOutputNodeProps) => (
  <GNodeShell
    leftHandle
    detail={data.projectId ?? "Project output"}
    icon={FolderOutput}
    id={id}
    kind="Output"
    selected={selected}
    theme="teal"
    title={data.label}
  >
    <GNodeCodeLine>{data.path}</GNodeCodeLine>
    {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
  </GNodeShell>
);

export const OutputLocalPathNode = ({ data, id, selected }: LocalOutputNodeProps) => (
  <GNodeShell
    leftHandle
    detail={data.outputMode ?? "Local output"}
    icon={HardDriveDownload}
    id={id}
    kind="Output"
    selected={selected}
    theme="teal"
    title={data.label}
  >
    <GNodeCodeLine>{data.localPath}</GNodeCodeLine>
    {data.outputFileName ? <GNodeMetaLine>{data.outputFileName}</GNodeMetaLine> : null}
  </GNodeShell>
);
