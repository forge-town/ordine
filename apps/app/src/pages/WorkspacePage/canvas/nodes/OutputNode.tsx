import { FolderOutput, HardDriveDownload, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const isOutputPort = data.label === "Output Port";

  return (
    <GNodeShell
      leftHandle
      detail={
        isOutputPort
          ? t("workspace.canvas.nodes.output.compoundOutput")
          : (data.projectId ?? t("workspace.canvas.nodes.output.projectOutput"))
      }
      icon={isOutputPort ? LogOut : FolderOutput}
      id={id}
      kind={
        isOutputPort
          ? t("workspace.canvas.nodes.kind.port")
          : t("workspace.canvas.nodes.kind.output")
      }
      selected={selected}
      theme={isOutputPort ? "emerald" : "teal"}
      title={data.label}
    >
      {data.path ? <GNodeCodeLine>{data.path}</GNodeCodeLine> : null}
      {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
    </GNodeShell>
  );
};

export const OutputLocalPathNode = ({ data, id, selected }: LocalOutputNodeProps) => {
  const { t } = useTranslation();

  return (
    <GNodeShell
      leftHandle
      detail={data.outputMode ?? t("workspace.canvas.nodes.output.localOutput")}
      icon={HardDriveDownload}
      id={id}
      kind={t("workspace.canvas.nodes.kind.output")}
      selected={selected}
      theme="teal"
      title={data.label}
    >
      <GNodeCodeLine>{data.localPath}</GNodeCodeLine>
      {data.outputFileName ? <GNodeMetaLine>{data.outputFileName}</GNodeMetaLine> : null}
    </GNodeShell>
  );
};
