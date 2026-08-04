import { Group } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CompoundNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeMetaLine } from "./NodeFields";

export interface CompoundNodeProps {
  data: CompoundNodeData;
  id: string;
  selected?: boolean;
}

export const CompoundNode = ({ data, id, selected }: CompoundNodeProps) => {
  const { t } = useTranslation();

  return (
    <GNodeShell
      leftHandle
      rightHandle
      canDuplicate={false}
      detail={t("workspace.canvas.nodes.compound.childCount", {
        count: data.childNodeIds.length,
      })}
      icon={Group}
      id={id}
      kind={t("workspace.canvas.nodes.kind.compound", {
        kind: data.compoundKind ?? t("workspace.canvas.nodes.kind.custom"),
      })}
      selected={selected}
      theme="indigo"
      title={data.label}
    >
      {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
      <GNodeMetaLine>{t("workspace.canvas.nodes.compound.openHint")}</GNodeMetaLine>
    </GNodeShell>
  );
};
