import { Bot } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/badge";
import { Result } from "neverthrow";

interface FindingsViewProps {
  output: string;
}

interface Finding {
  id: string;
  severity: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

interface ParsedFindings {
  summary?: string;
  findings?: Finding[];
  stats?: Record<string, number>;
}

const SEVERITY_STYLE: Record<string, string> = {
  error: "bg-red-500/10 text-red-600 border-red-500/30",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

export const FindingsView = ({ output }: FindingsViewProps) => {
  const parsed = Result.fromThrowable(
    () => JSON.parse(output) as ParsedFindings,
    () => null,
  )();
  if (parsed.isErr()) return null;
  const data = parsed.value;
  if (!data?.findings) return null;

  return (
    <div className="space-y-3">
      {data.summary && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </span>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">{data.summary}</p>
        </div>
      )}
      {data.findings.map((f) => (
        <div
          key={f.id}
          className={cn("rounded-lg border p-3", SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.info)}
        >
          <div className="flex items-center gap-2 mb-1">
            <Badge className="h-4 text-[10px]" variant="outline">
              {f.severity}
            </Badge>
            <span className="text-xs font-medium">{f.message}</span>
          </div>
          {f.file && (
            <p className="text-[11px] text-muted-foreground font-mono mt-1">
              {f.file}
              {f.line ? `:${f.line}` : ""}
            </p>
          )}
          {f.suggestion && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              💡 {f.suggestion}
            </p>
          )}
        </div>
      ))}
      {data.stats && (
        <div className="flex gap-3 text-[11px] text-muted-foreground px-1">
          {Object.entries(data.stats).map(([k, v]) => (
            <span key={k}>
              {k}: <span className="font-medium text-foreground">{v}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
