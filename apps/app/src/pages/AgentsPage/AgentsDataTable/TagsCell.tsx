import type { Agent } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";

export const TagsCell = ({ agent }: { agent: Agent }) =>
  agent.tags.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {agent.tags.map((tag) => (
        <Badge key={tag} className="text-[10px]" variant="outline">
          {tag}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-sm text-muted-foreground/50">—</span>
  );
