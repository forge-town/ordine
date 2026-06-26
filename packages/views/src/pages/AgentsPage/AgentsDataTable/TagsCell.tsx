import type { Agent } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";

interface TagsCellProps {
  agent: Agent;
}

export const TagsCell = ({ agent }: TagsCellProps) => {
  if (agent.tags.length === 0) {
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
