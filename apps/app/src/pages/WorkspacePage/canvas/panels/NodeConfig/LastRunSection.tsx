import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpcClient } from "@/integrations/trpc/client";
import { useCanvasStore } from "../../_store/canvasStore";
import { ArtifactPreview, type ArtifactFileLoadResult } from "../ArtifactPreview";
import type { NodeConfigSectionProps } from "./types";

// 模块级稳定引用：避免每次渲染新建 loadFile 触发 ArtifactPreview 的加载 effect 重跑。
const loadArtifactFile = (filePath: string): Promise<ArtifactFileLoadResult> =>
  trpcClient.artifacts.readFile.query({ filePath });

export const LastRunSection = ({ node }: NodeConfigSectionProps) => {
  const { t } = useTranslation();
  const runStatus = useCanvasStore((state) => state.nodeRunStatuses[node.id]);
  const llmContent = useCanvasStore((state) => state.nodeLlmContent[node.id]);
  const artifact = useCanvasStore((state) => state.nodeArtifacts[node.id]);
  const status = runStatus ?? ("status" in node.data ? node.data.status : "idle");
  const hasOutput = Boolean(artifact) || Boolean(llmContent);

  return (
    <section className="space-y-2 rounded-xl bg-surface-2/60 p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Activity className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold">{t("workspace.canvas.nodeConfig.lastRun.title")}</h3>
      </div>
      <div className="grid grid-cols-[72px_1fr] gap-2 text-xs">
        <span className="text-muted-foreground">
          {t("workspace.canvas.nodeConfig.lastRun.status")}
        </span>
        <span className="font-mono" data-testid="node-config-last-run-status">
          {String(status ?? "idle")}
        </span>
        <span className="text-muted-foreground">
          {t("workspace.canvas.nodeConfig.lastRun.output")}
        </span>
        {!hasOutput && (
          <span className="truncate">{t("workspace.canvas.nodeConfig.lastRun.noOutput")}</span>
        )}
      </div>
      {artifact ? (
        <ArtifactPreview artifact={artifact} loadFile={loadArtifactFile} />
      ) : (
        llmContent && (
          <ArtifactPreview
            artifact={{ kind: "inline", contentType: "markdown", content: llmContent }}
          />
        )
      )}
    </section>
  );
};
