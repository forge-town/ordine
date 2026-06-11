import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FolderObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface FolderNodeProps {
  data: FolderObjectNodeData;
  id: string;
  selected?: boolean;
}

export const FolderNode = ({ data, id, selected }: FolderNodeProps) => {
  const { t } = useTranslation();

  return (
    <GNodeShell
      rightHandle
      detail={data.disclosureMode ?? t("workspace.canvas.nodes.folder.input")}
      icon={Folder}
      id={id}
      kind={t("workspace.canvas.nodes.kind.folder")}
      selected={selected}
      theme="amber"
      title={data.label}
    >
      <GNodeCodeLine>
        {data.folderPath || t("workspace.canvas.nodes.folder.noFolderSelected")}
      </GNodeCodeLine>
      {data.includedExtensions?.length ? (
        <GNodeMetaLine>{data.includedExtensions.join(", ")}</GNodeMetaLine>
      ) : null}
    </GNodeShell>
  );
};
