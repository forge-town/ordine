import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GithubProjectObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface GithubProjectNodeProps {
  data: GithubProjectObjectNodeData;
  id: string;
  selected?: boolean;
}

export const GithubProjectNode = ({ data, id, selected }: GithubProjectNodeProps) => {
  const { t } = useTranslation();

  return (
    <GNodeShell
      rightHandle
      detail={data.branch ?? data.sourceType ?? t("workspace.canvas.nodes.github.detail")}
      icon={GitBranch}
      id={id}
      kind={t("workspace.canvas.nodes.kind.github")}
      selected={selected}
      theme="indigo"
      title={data.label}
    >
      <GNodeCodeLine>
        {data.owner}/{data.repo}
      </GNodeCodeLine>
      {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
    </GNodeShell>
  );
};
