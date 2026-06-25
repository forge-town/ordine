import Markdown from "react-markdown";
import { Code, Eye } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useOperationDetailPageStore } from "../_store";

interface TemplateContentViewProps {
  templateId: string;
}

const PREVIEWABLE_TYPES = new Set(["markdown", "html"]);

export const TemplateContentView = ({ templateId }: TemplateContentViewProps) => {
  const store = useOperationDetailPageStore();
  const { template, templateViewMode, handleTemplateViewModeButtonClick } = useStore(
    store,
    useShallow((s) => ({
      template: s.templates[templateId],
      templateViewMode: s.templateViewMode,
      handleTemplateViewModeButtonClick: s.handleTemplateViewModeButtonClick,
    })),
  );

  if (!template) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    );
  }

  const canPreview = PREVIEWABLE_TYPES.has(template.contentType);

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">{template.name}</span>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {template.contentType}
          </span>
        </div>
        {canPreview && (
          <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
            <Button
              className={cn(
                "flex h-auto items-center gap-1 rounded px-2 py-1 text-[10px] font-medium",
                templateViewMode === "raw"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              variant="ghost"
              onClick={handleTemplateViewModeButtonClick.bind(null, "raw")}
            >
              <Code className="h-3 w-3" />
              Raw
            </Button>
            <Button
              className={cn(
                "flex h-auto items-center gap-1 rounded px-2 py-1 text-[10px] font-medium",
                templateViewMode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              variant="ghost"
              onClick={handleTemplateViewModeButtonClick.bind(null, "preview")}
            >
              <Eye className="h-3 w-3" />
              Preview
            </Button>
          </div>
        )}
      </div>
      {template.description && (
        <p className="mb-3 text-xs text-muted-foreground">{template.description}</p>
      )}
      {canPreview && templateViewMode === "preview" ? (
        <div className="max-h-96 overflow-auto rounded-lg border border-border bg-background p-4">
          {template.contentType === "markdown" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{template.content}</Markdown>
            </div>
          ) : (
            <iframe
              className="h-96 w-full rounded-lg border-0"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={template.content}
              title={template.name}
            />
          )}
        </div>
      ) : (
        <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-all">
          {template.content}
        </pre>
      )}
    </div>
  );
};
