import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { AgentRunSchema, type AgentRun, type AgentRuntimeCatalogEntry } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet";
import { AgentActivitySurface } from "../../components/AgentActivity";
import { usePlatform } from "../../platform";

interface RuntimeConnectionTestSheetProps {
  entry: AgentRuntimeCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RuntimeConnectionTestSheet = ({
  entry,
  open,
  onOpenChange: handleOpenChange,
}: RuntimeConnectionTestSheetProps) => {
  const platform = usePlatform();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    const terminal = new Set(["completed", "failed", "cancelled", "timed_out", "interrupted"]);
    const poll = async () => {
      const response = await platform.request(
        `${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(runId)}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        setError(`Connection test status request failed (${response.status})`);

        return;
      }
      const parsed = AgentRunSchema.safeParse(await response.json());
      if (!parsed.success) {
        setError("Connection test returned an invalid run record");

        return;
      }
      setRun(parsed.data);
      if (!terminal.has(parsed.data.status)) {
        pollTimerRef.current = globalThis.setTimeout(() => void poll(), 500);
      }
    };
    void poll();

    return () => {
      controller.abort();
      if (pollTimerRef.current) globalThis.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [platform, runId]);

  const handleRun = useCallback(async () => {
    if (!entry?.runtimeConfigId) return;
    setRun(null);
    setError(null);
    setRunId(null);
    const response = await platform.request(
      `${platform.apiBaseUrl}/agent-runtimes/${encodeURIComponent(entry.runtimeConfigId)}/connection-tests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? `Connection test failed to start (${response.status})`);

      return;
    }
    const body = (await response.json()) as { runId?: string };
    if (!body.runId) {
      setError("Connection test did not return a run ID");

      return;
    }
    setRunId(body.runId);
  }, [entry?.runtimeConfigId, platform]);

  const steps = [
    {
      label: "Detected",
      passed: entry?.availability === "detected" || entry?.availability === "launchable",
      detail: entry?.path ?? undefined,
    },
    {
      label: "Command launched",
      passed: Boolean(run?.startedAt),
      detail: run?.executablePath ?? undefined,
    },
    {
      label: "Model call succeeded",
      passed:
        run?.status === "completed" && run.resultText?.includes("ORDINE_CONNECTION_OK") === true,
      detail: run?.status ?? (runId ? "queued" : "not started"),
    },
  ];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{entry?.displayName ?? "Runtime"} connection test</SheetTitle>
          <SheetDescription>
            This performs one real model call and may consume provider quota.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          {steps.map((step) => (
            <div key={step.label} className="flex items-start gap-2 rounded-lg border p-3">
              {step.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : runId && !error ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.label}</p>
                {step.detail && (
                  <p className="mt-0.5 break-all text-xs text-muted-foreground">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
          <div className="rounded-lg bg-surface-2 p-3 text-xs leading-5 text-muted-foreground">
            Isolation:{" "}
            {entry?.runtime === "codex" ? "native Codex sandbox" : "CLI policy / best-effort"}. The
            probe uses the same absolute executable and adapter as a product run.
          </div>
          {runId && <AgentActivitySurface platform={platform} runId={runId} variant="panel" />}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {run?.errorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive">
              {run.errorCode}: {run.errorMessage}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button disabled={Boolean(runId && !run?.finishedAt)} onClick={handleRun}>
            Run connection test
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
