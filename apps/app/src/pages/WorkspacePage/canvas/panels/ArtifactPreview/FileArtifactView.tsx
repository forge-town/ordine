import { useTranslation } from "react-i18next";
import type { NodeArtifact } from "@repo/schemas";
import { ArtifactContent } from "./ArtifactContent";
import { useArtifactFile } from "./useArtifactFile";
import type { ArtifactFileLoader } from "./types";

type FileArtifactViewProps = {
  artifact: NodeArtifact;
  loadFile?: ArtifactFileLoader;
};

/** kind=file：content 是单文件路径，经 loader 读出后渲染。 */
export const FileArtifactView = ({ artifact, loadFile }: FileArtifactViewProps) => {
  const { t } = useTranslation();
  const state = useArtifactFile(artifact.content ?? null, loadFile);

  if (state.status === "loading") {
    return (
      <p className="p-3 text-xs text-muted-foreground">{t("workspace.canvas.preview.loading")}</p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="p-3 text-xs text-muted-foreground">{t("workspace.canvas.preview.error")}</p>
    );
  }

  return (
    <div className="space-y-1">
      <ArtifactContent
        content={state.data.content}
        contentType={state.data.contentType}
        path={artifact.content}
      />
      {state.data.truncated && (
        <p className="text-[10px] text-muted-foreground">
          {t("workspace.canvas.preview.truncated")}
        </p>
      )}
    </div>
  );
};
