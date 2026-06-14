import { FileCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FileObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface FileNodeProps {
  data: FileObjectNodeData;
  id: string;
  selected?: boolean;
}

export const FileNode = ({ data, id, selected }: FileNodeProps) => {
  const { t } = useTranslation();

  return (
    <GNodeShell
      rightHandle
      detail={data.language ?? t("workspace.canvas.nodes.file.input")}
      icon={FileCode}
      id={id}
      kind={t("workspace.canvas.nodes.kind.file")}
      selected={selected}
      theme="orange"
      title={data.label}
    >
      <GNodeCodeLine>
        {data.filePath || t("workspace.canvas.nodes.file.noFileSelected")}
      </GNodeCodeLine>
      {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
    </GNodeShell>
  );
};
