import { FolderOutput, HardDriveDownload, LogOut } from "lucide-react";
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

export const OutputProjectPathNode = ({ data, id, selected }: ProjectOutputNodeProps) => {
  const isOutputPort = data.label === "Output Port";

  return (
    <GNodeShell
      leftHandle
      detail={isOutputPort ? "Compound output" : (data.projectId ?? "Project output")}
      icon={isOutputPort ? LogOut : FolderOutput}
      id={id}
      kind={isOutputPort ? "Port" : "Output"}
      selected={selected}
      theme={isOutputPort ? "emerald" : "teal"}
      title={data.label}
    >
      {data.path ? <GNodeCodeLine>{data.path}</GNodeCodeLine> : null}
      {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
    </GNodeShell>
  );
};

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
