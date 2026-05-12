import Markdown from "react-markdown";
import { Code, Eye } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { OperationOutputItemTemplate } from "@repo/schemas";
import { useOperationDetailPageStore } from "../_store";

interface TemplateContentViewProps {
  template: OperationOutputItemTemplate;
}

const PREVIEWABLE_TYPES = new Set(["markdown", "html"]);

export const TemplateContentView = ({ template }: TemplateContentViewProps) => {
  const store = useOperationDetailPageStore();
  const { templateViewMode, handleSetTemplateViewMode } = useStore(
    store,
    useShallow((s) => ({
      templateViewMode: s.templateViewMode,
      handleSetTemplateViewMode: s.handleSetTemplateViewMode,
    }))
  );

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
            <button
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                templateViewMode === "raw"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={handleSetTemplateViewMode.bind(null, "raw")}
            >
              <Code className="h-3 w-3" />
              Raw
            </button>
            <button
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                templateViewMode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={handleSetTemplateViewMode.bind(null, "preview")}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
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
