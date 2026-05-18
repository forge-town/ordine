import { useOne } from "@refinedev/core";
import type { Agent } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface TagsCellProps {
  agentId: string;
}

export const TagsCell = ({ agentId }: TagsCellProps) => {
  const { result: agent } = useOne<Agent>({
    resource: ResourceName.agents,
    id: agentId,
  });

  if (!agent || agent.tags.length === 0) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {agent.tags.map((tag) => (
        <Badge key={tag} className="text-[10px]" variant="outline">
          {tag}
        </Badge>
      ))}
    </div>
  );
};
