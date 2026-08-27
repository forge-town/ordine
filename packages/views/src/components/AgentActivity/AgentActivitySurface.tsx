import {
  CircleAlert,
  Copy,
  ExternalLink,
  FileOutput,
  LoaderCircle,
  Square,
  Wrench,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { PlatformCapabilities } from "../../platform";
import { recordAgentActivityArtifactOpenFailure } from "./agentActivityStore";
import { useAgentActivity } from "./useAgentActivity";

export type AgentActivityVariant = "bar" | "panel" | "inline" | "console";

const formatElapsed = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1_000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

export const AgentActivitySurface = ({
  runId,
  platform,
  variant = "panel",
  className,
}: {
  runId: string | null | undefined;
  platform: PlatformCapabilities;
  variant?: AgentActivityVariant;
  className?: string;
}) => {
  const activity = useAgentActivity({ runId, platform });
  if (!runId) return null;
  const terminal = ["completed", "failed", "cancelled", "timed_out", "interrupted"].includes(
    activity.status ?? "",
  );

  return (
    <section
      className={cn(
        "text-xs text-muted-foreground",
        variant === "bar" && "flex items-center gap-2 border-b border-border/70 px-3 py-2",
        variant === "panel" && "rounded-lg border border-border/80 bg-surface-2/45 p-3",
        variant === "inline" && "flex items-center gap-2",
        variant === "console" && "rounded-md bg-black/80 p-3 font-mono text-[11px] text-white/80",
        className,
      )}
      data-testid={`agent-activity-${variant}`}
      data-run-id={runId}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-2", variant === "panel" && "mb-2")}>
        {activity.connection === "streaming" || activity.connection === "polling" ? (
          <LoaderCircle className="size-3.5 animate-spin text-primary" />
        ) : activity.error ? (
          <CircleAlert className="size-3.5 text-destructive" />
        ) : (
          <FileOutput className="size-3.5" />
        )}
        <span className="truncate font-medium text-foreground">
          {activity.runtime ?? "Agent"} · {activity.phase}
        </span>
        <span className="shrink-0 tabular-nums">{formatElapsed(activity.elapsedMs)}</span>
        {activity.connection === "polling" && <span className="shrink-0">polling</span>}
      </div>
      {variant !== "bar" && variant !== "inline" && (
        <>
          {activity.content ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-foreground/90">
              {activity.content}
            </pre>
          ) : (
            <p className="py-1">
              {activity.progressMessage ?? "Waiting for first available output"}
            </p>
          )}
          {activity.activeTools.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activity.activeTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5"
                >
                  <Wrench className="size-3" /> {tool.name}
                </span>
              ))}
            </div>
          )}
          {activity.artifacts.length > 0 && (
            <div className="mt-2 space-y-1">
              {activity.artifacts.map((artifact) => (
                <div key={artifact.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{artifact.label}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {artifact.openModes.includes("open") &&
                    artifact.localPath &&
                    platform.openPath ? (
                      <button
                        type="button"
                        aria-label={`Open ${artifact.label}`}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                        title="Open artifact"
                        onClick={() => {
                          void platform.openPath!(artifact.localPath!).catch(() =>
                            recordAgentActivityArtifactOpenFailure(runId, platform),
                          );
                        }}
                      >
                        <ExternalLink className="size-3" />
                      </button>
                    ) : null}
                    {artifact.openModes.includes("copy_path") &&
                    (artifact.localPath || artifact.remotePath) ? (
                      <button
                        type="button"
                        aria-label={`Copy ${artifact.label} path`}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                        title={artifact.remotePath ? "Remote artifact: copy path" : "Copy path"}
                        onClick={() => {
                          const path = artifact.localPath ?? artifact.remotePath;
                          if (!path) return;
                          void platform
                            .copyText(path)
                            .catch(() => recordAgentActivityArtifactOpenFailure(runId, platform));
                        }}
                      >
                        <Copy className="size-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {!terminal && activity.canCancel && variant !== "inline" && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
          onClick={() => void activity.cancel()}
        >
          <Square className="size-3" /> Cancel
        </button>
      )}
    </section>
  );
};
