import { GitBranch } from "lucide-react";
import type { GithubProjectObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface GithubProjectNodeProps {
  data: GithubProjectObjectNodeData;
  id: string;
  selected?: boolean;
}

export const GithubProjectNode = ({ data, id, selected }: GithubProjectNodeProps) => (
  <GNodeShell
    rightHandle
    detail={data.branch ?? data.sourceType ?? "GitHub"}
    icon={GitBranch}
    id={id}
    kind="GitHub project"
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
