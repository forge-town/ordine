import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useOne, useCustomMutation } from "@refinedev/core";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Pencil,
  PlugZap,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Separator } from "@repo/ui/separator";
import { AgentRunSchema, type AgentRun, type AgentRuntimeConfig } from "@repo/schemas";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { RuntimeIcon } from "../../../pages/RuntimesPage/RuntimeIcon";
import { usePlatform } from "../../../platform";

const s = "runtimes";

type McpSetupResult = {
  status?: string;
  message?: string;
  copyCommand?: string;
  error?: string;
  evidence?: {
    registered: boolean;
    commandLaunchable: boolean;
    initialize: boolean;
    toolsList: boolean;
    safeToolCall: boolean;
  };
};

const InfoField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-1 text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}>{value}</div>
  </div>
);

export const RuntimeDetailPageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const platform = usePlatform();
  const { runtimeId } = useParams({ strict: false }) as { runtimeId: string };
  const { result, query: runtimeQuery } = useOne<AgentRuntimeConfig>({
    resource: "agentRuntimes",
    id: runtimeId,
  });
  const { mutateAsync: syncAll } = useCustomMutation();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [connectionTestOpen, setConnectionTestOpen] = useState(false);
  const [connectionTestRun, setConnectionTestRun] = useState<AgentRun | null>(null);
  const [connectionTestRunId, setConnectionTestRunId] = useState<string | null>(null);
  const [connectionTestError, setConnectionTestError] = useState<string | null>(null);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpResult, setMcpResult] = useState<McpSetupResult | null>(null);

  const runtime = result ?? null;
  const supportsProductConnectionTest =
    runtime?.connection.mode === "local" &&
    ["codex", "claude-code", "opencode"].includes(runtime.type);

  useEffect(() => {
    if (!connectionTestRunId) return;
    const controller = new AbortController();
    const terminal = new Set(["completed", "failed", "cancelled", "timed_out", "interrupted"]);
    const poll = async () => {
      const response = await platform.request(
        `${platform.apiBaseUrl}/agent-runs/${encodeURIComponent(connectionTestRunId)}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        setConnectionTestError(`Connection test status request failed (${response.status})`);
        return;
      }
      const parsed = AgentRunSchema.safeParse(await response.json());
      if (!parsed.success) {
        setConnectionTestError("Connection test returned an invalid run record");
        return;
      }
      setConnectionTestRun(parsed.data);
      if (!terminal.has(parsed.data.status)) {
        globalThis.setTimeout(() => void poll(), 500);
      }
    };
    void poll();

    return () => controller.abort();
  }, [connectionTestRunId, platform]);

  const handleConnectionTest = useCallback(async () => {
    setConnectionTestOpen(true);
    setConnectionTestRun(null);
    setConnectionTestError(null);
    setConnectionTestRunId(null);
    const response = await platform.request(
      `${platform.apiBaseUrl}/agent-runtimes/${encodeURIComponent(runtimeId)}/connection-tests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setConnectionTestError(body.error ?? `Connection test failed to start (${response.status})`);
      return;
    }
    const body = (await response.json()) as { runId?: string };
    if (!body.runId) {
      setConnectionTestError("Connection test did not return a run ID");
      return;
    }
    setConnectionTestRunId(body.runId);
  }, [platform, runtimeId]);

  const runMcpAction = useCallback(
    async (action: "install" | "status" | "doctor" | "uninstall") => {
      setMcpOpen(true);
      setMcpBusy(true);
      const response = await platform.request(
        `${platform.apiBaseUrl}/agent-runtimes/${encodeURIComponent(runtimeId)}/mcp`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = (await response.json()) as McpSetupResult;
      setMcpResult(body);
      setMcpBusy(false);
    },
    [platform, runtimeId],
  );

  const handleEdit = useCallback(() => {
    navigate({ to: "/runtimes/$runtimeId/edit", params: { runtimeId } });
  }, [navigate, runtimeId]);

  const handleDeleteBlur = useCallback(() => {
    setDeleteConfirm(false);
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);

      return;
    }
    if (!runtime) return;
    syncAll({
      url: "agentRuntimes/syncAll",
      method: "post",
      values: { runtimes: [] },
    }).then(() => {
      navigate({ to: "/runtimes" });
    });
  }, [deleteConfirm, runtime, syncAll, navigate]);

  if (runtimeQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          backTo="/runtimes"
          icon={<Server className="h-4 w-4 text-primary" />}
          title={t(`${s}.title`)}
        />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader backTo="/runtimes" title={t(`${s}.title`)} />
        <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
          <div>
            <Server className="mx-auto size-8 text-muted-foreground/25" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("common.notFound")}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => runtimeQuery.refetch()}
            >
              <RefreshCw className="size-3.5" />
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            {supportsProductConnectionTest && (
              <Button size="sm" variant="outline" onClick={() => void runMcpAction("status")}>
                <Server className="mr-1.5 h-3.5 w-3.5" />
                MCP setup
              </Button>
            )}
            {supportsProductConnectionTest && (
              <Button size="sm" variant="outline" onClick={handleConnectionTest}>
                <PlugZap className="mr-1.5 h-3.5 w-3.5" />
                Connection test
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t(`${s}.edit`)}
            </Button>
            <Button
              size="icon"
              variant={deleteConfirm ? "destructive" : "ghost"}
              onBlur={handleDeleteBlur}
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
        backTo="/runtimes"
        icon={<RuntimeIcon className="h-4 w-4" type={runtime.type} />}
        title={runtime.name || t(`${s}.unnamed`)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        <div className={cn(surfaceCardVariants(), "mx-auto max-w-3xl space-y-5 p-4 sm:p-5")}>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <InfoField label={t(`${s}.name`)} value={runtime.name || "—"} />
            <InfoField label={t(`${s}.type`)} value={runtime.type} />
            <InfoField label={t(`${s}.runtimeMode`)} value={runtime.connection.mode} />
            <InfoField label={t(`${s}.provider`)} value={runtime.type} />
          </div>

          <Separator />

          <InfoField mono label={t(`${s}.runtimeId`)} value={runtime.id} />

          {runtime.connection.mode === "ssh" && (
            <>
              <Separator />
              <div className="rounded-lg bg-surface-2/60 p-4 ring-1 ring-border">
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {t(`${s}.sshConfig`)}
                </h3>
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 pt-3 sm:grid-cols-2">
                  <InfoField label={t(`${s}.host`)} value={runtime.connection.host} />
                  <InfoField label={t(`${s}.user`)} value={runtime.connection.user} />
                  {runtime.connection.port && (
                    <InfoField label={t(`${s}.port`)} value={String(runtime.connection.port)} />
                  )}
                  {runtime.connection.keyPath && (
                    <InfoField mono label={t(`${s}.keyPath`)} value={runtime.connection.keyPath} />
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t(`${s}.metadata`)}
            </h3>
            <pre className="overflow-x-auto rounded-lg bg-surface-2/60 p-4 font-mono text-xs text-muted-foreground ring-1 ring-border">
              {JSON.stringify(runtime.connection, null, 2)}
            </pre>
          </div>
        </div>
      </div>
      <Sheet open={connectionTestOpen} onOpenChange={setConnectionTestOpen}>
        <SheetContent className="w-full sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>Runtime connection test</SheetTitle>
            <SheetDescription>
              This performs one real model call and may consume provider quota.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            {[
              {
                label: "Detected",
                passed: runtime.connection.mode === "local" && Boolean(runtime.connection.path),
                detail: runtime.connection.mode === "local" ? runtime.connection.path : undefined,
              },
              {
                label: "Command launched",
                passed: Boolean(connectionTestRun?.startedAt),
                detail: connectionTestRun?.executablePath ?? undefined,
              },
              {
                label: "Model call succeeded",
                passed:
                  connectionTestRun?.status === "completed" &&
                  connectionTestRun.resultText?.includes("ORDINE_CONNECTION_OK") === true,
                detail:
                  connectionTestRun?.status ?? (connectionTestRunId ? "queued" : "not started"),
              },
            ].map((step) => (
              <div
                key={step.label}
                className="flex items-start gap-2 rounded-lg border border-border p-3"
              >
                {step.passed ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : connectionTestRunId && !connectionTestError ? (
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
              {runtime.type === "codex"
                ? "native Codex sandbox (full access by default; read-only and workspace-write remain available)"
                : runtime.type === "claude-code"
                  ? "Claude Code permission mode and explicit tool policy (best-effort isolation)"
                  : "OpenCode permission policy with explicit external-directory and dangerous-command denies (best-effort isolation)"}
              . The probe performs one safe model request with the same local-agent invocation
              policy.
            </div>
            {connectionTestError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive">
                {connectionTestError}
              </div>
            )}
            {connectionTestRun?.errorMessage && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive">
                {connectionTestRun.errorCode}: {connectionTestRun.errorMessage}
              </div>
            )}
          </div>
          <SheetFooter>
            <Button
              disabled={Boolean(connectionTestRunId && !connectionTestRun?.finishedAt)}
              onClick={handleConnectionTest}
            >
              Run connection test
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={mcpOpen} onOpenChange={setMcpOpen}>
        <SheetContent className="w-full sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>ORDINE MCP setup</SheetTitle>
            <SheetDescription>
              Desktop can safely register the packaged sidecar. Web mode provides a copyable CLI
              command only.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            {mcpBusy && (
              <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Inspecting MCP registration…
              </div>
            )}
            {mcpResult?.copyCommand && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Run this command locally</p>
                <code className="block select-all break-all rounded bg-surface-2 p-2 text-xs">
                  {mcpResult.copyCommand}
                </code>
              </div>
            )}
            {mcpResult?.message && (
              <p className="text-sm text-muted-foreground">{mcpResult.message}</p>
            )}
            {mcpResult?.error && <p className="text-sm text-destructive">{mcpResult.error}</p>}
            {mcpResult?.evidence && (
              <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
                {[
                  ["Registered", mcpResult.evidence.registered],
                  ["Command launch", mcpResult.evidence.commandLaunchable],
                  ["initialize", mcpResult.evidence.initialize],
                  ["tools/list", mcpResult.evidence.toolsList],
                  ["ordine.list_jobs", mcpResult.evidence.safeToolCall],
                ].map(([label, passed]) => (
                  <div key={String(label)} className="flex items-center justify-between">
                    <span>{label}</span>
                    <span>{passed ? "passed" : "not proven"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <SheetFooter>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={mcpBusy} onClick={() => void runMcpAction("install")}>
                Install
              </Button>
              <Button
                disabled={mcpBusy}
                variant="outline"
                onClick={() => void runMcpAction("doctor")}
              >
                Doctor
              </Button>
              <Button
                disabled={mcpBusy}
                variant="outline"
                onClick={() => void runMcpAction("status")}
              >
                Status
              </Button>
              <Button
                disabled={mcpBusy}
                variant="destructive"
                onClick={() => void runMcpAction("uninstall")}
              >
                Uninstall
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
