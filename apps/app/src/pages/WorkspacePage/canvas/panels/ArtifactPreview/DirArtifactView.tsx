import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { ScrollArea } from "@repo/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import type { NodeArtifact } from "@repo/schemas";
import { ArtifactContent } from "./ArtifactContent";
import { useArtifactFile } from "./useArtifactFile";
import type { ArtifactFileLoader } from "./types";

const joinPath = (dir: string, rel: string): string =>
  dir.endsWith("/") ? `${dir}${rel}` : `${dir}/${rel}`;

type DirArtifactViewProps = {
  artifact: NodeArtifact;
  loadFile?: ArtifactFileLoader;
};

/** kind=dir：左侧文件树 + 右侧选中文件预览（经 loader 读出）。 */
export const DirArtifactView = ({ artifact, loadFile }: DirArtifactViewProps) => {
  const { t } = useTranslation();
  const files = artifact.files ?? [];
  const [selected, setSelected] = useState(files.length > 0 ? 0 : -1);
  const file = selected >= 0 ? files[selected] : undefined;
  const fullPath = file && artifact.content ? joinPath(artifact.content, file.path) : null;
  const state = useArtifactFile(fullPath, loadFile);

  return (
    <div className="grid grid-cols-[150px_1fr] gap-2">
      <ScrollArea className="max-h-96 rounded-lg bg-surface-2/60 p-1">
        <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          {t("workspace.canvas.preview.fileTree")}
        </p>
        {files.map((f, i) => (
          <button
            key={f.path}
            type="button"
            data-testid={`artifact-preview-tab-${i}`}
            onClick={() => setSelected(i)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs",
              i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
            )}
          >
            <FileText className="size-3 shrink-0" />
            <span className="truncate">{f.path}</span>
          </button>
        ))}
      </ScrollArea>
      <div className="min-w-0 space-y-1">
        {file ? (
          state.status === "loading" ? (
            <p className="p-3 text-xs text-muted-foreground">
              {t("workspace.canvas.preview.loading")}
            </p>
          ) : state.status === "error" ? (
            <p className="p-3 text-xs text-muted-foreground">
              {t("workspace.canvas.preview.error")}
            </p>
          ) : (
            <>
              <ArtifactContent
                content={state.data.content}
                contentType={state.data.contentType}
                path={file.path}
                title={file.path}
              />
              {state.data.truncated && (
                <p className="text-[10px] text-muted-foreground">
                  {t("workspace.canvas.preview.truncated")}
                </p>
              )}
            </>
          )
        ) : (
          <p className="p-3 text-xs text-muted-foreground">
            {t("workspace.canvas.preview.selectFile")}
          </p>
        )}
      </div>
    </div>
  );
};
