import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@repo/ui/button";
import type { NodeArtifact } from "@repo/schemas";
import { ArtifactContent } from "./ArtifactContent";
import { DirArtifactView } from "./DirArtifactView";
import { FileArtifactView } from "./FileArtifactView";
import type { ArtifactFileLoader } from "./types";

type ArtifactPreviewProps = {
  artifact: NodeArtifact;
  /** dir/file 工件读取文件内容的注入式 loader（inline 工件无需）。 */
  loadFile?: ArtifactFileLoader;
};

/** 节点产物预览：按 kind（inline/file/dir）与 contentType 路由渲染。 */
export const ArtifactPreview = ({ artifact, loadFile }: ArtifactPreviewProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const hasInlineContent = artifact.kind === "inline" && !!artifact.content;

  const handleCopy = () => {
    if (!artifact.content) return;
    void navigator.clipboard?.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleOpenExternal = () => {
    const w = window.open();
    if (w && artifact.content) {
      w.document.write(artifact.content);
      w.document.close();
    }
  };

  return (
    <section className="space-y-2" data-testid="artifact-preview">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium">
            {artifact.label ?? t("workspace.canvas.preview.title")}
          </span>
          <span className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            {artifact.contentType}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {artifact.contentType === "html" && hasInlineContent && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleOpenExternal}
              data-testid="artifact-preview-open-external"
            >
              <ExternalLink />
              {t("workspace.canvas.preview.openExternal")}
            </Button>
          )}
          {hasInlineContent && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleCopy}
              data-testid="artifact-preview-copy"
            >
              {copied ? <Check /> : <Copy />}
              {copied ? t("workspace.canvas.preview.copied") : t("workspace.canvas.preview.copy")}
            </Button>
          )}
        </div>
      </header>
      {artifact.kind === "dir" ? (
        <DirArtifactView artifact={artifact} loadFile={loadFile} />
      ) : artifact.kind === "file" ? (
        <FileArtifactView artifact={artifact} loadFile={loadFile} />
      ) : artifact.content ? (
        <ArtifactContent
          content={artifact.content}
          contentType={artifact.contentType}
          title={artifact.label}
        />
      ) : (
        <p className="p-3 text-xs text-muted-foreground" data-testid="artifact-preview-empty">
          {t("workspace.canvas.preview.empty")}
        </p>
      )}
    </section>
  );
};
