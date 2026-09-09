import { useState } from "react";
import { Refine } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import {
  ExecutionWorkspacePage,
  ExecutionWorkspaceProvider,
} from "@repo/views/ExecutionWorkspacePage";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { connectExecution, type ExecutionConnection } from "./connection";

export const ExecutionWebApp = () => {
  const [connection, setConnection] = useState<ExecutionConnection | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:19433");
  const [token, setToken] = useState("");
  const [transport, setTransport] = useState<"bearer" | "desktop">("bearer");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const handleTheme = () => {
    document.documentElement.classList.toggle("dark", !dark);
    setDark(!dark);
  };
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setBaseUrl(event.target.value);
  const handleTokenChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setToken(event.target.value);
  const handleBearer = () => setTransport("bearer");
  const handleDesktop = () => setTransport("desktop");
  const handleConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await ResultAsync.fromPromise(
      connectExecution({ baseUrl, token, transport }),
      (error) => (error instanceof Error ? error.message : "连接失败"),
    );
    setPending(false);
    if (result.isErr()) setError(result.error);
    else {
      setConnection(result.value);
      setToken("");
    }
  };
  const handleDisconnect = () => {
    connection?.queryClient.clear();
    setConnection(null);
    setToken("");
    setError(null);
  };
  if (connection)
    return (
      <div className="flex h-dvh min-h-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 text-xs sm:px-7">
          <span className="min-w-0 break-all text-muted-foreground">
            {connection.baseUrl} · {connection.readiness.workspaceId}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleTheme}>
              {dark ? "浅色" : "深色"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect}>
              断开连接
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Refine
            key={connection.recoveryKey}
            dataProvider={connection.provider}
            options={{
              reactQuery: { clientConfig: connection.queryClient },
              disableTelemetry: true,
            }}
          >
            <ExecutionWorkspaceProvider
              initialPipelineId={new URLSearchParams(location.search).get("pipeline") ?? undefined}
              recoveryKey={connection.recoveryKey}
            >
              <ExecutionWorkspacePage />
            </ExecutionWorkspaceProvider>
          </Refine>
        </div>
      </div>
    );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-lg space-y-5 p-5" variant="surface">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">连接执行工作台</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              连接你的 ORDINE v2 服务，管理 Pipeline 并核对交付。
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={handleTheme}>
            {dark ? "浅色" : "深色"}
          </Button>
        </div>
        <form className="space-y-4" onSubmit={handleConnect}>
          <div className="space-y-2">
            <Label htmlFor="execution-api-url">执行服务地址</Label>
            <Input
              disabled={pending}
              id="execution-api-url"
              value={baseUrl}
              onChange={handleUrlChange}
            />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              type="button"
              variant={transport === "bearer" ? "secondary" : "outline"}
              onClick={handleBearer}
            >
              Service / Bearer
            </Button>
            <Button
              disabled={pending}
              type="button"
              variant={transport === "desktop" ? "secondary" : "outline"}
              onClick={handleDesktop}
            >
              Desktop
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="execution-app-token">App Token</Label>
            <Input
              autoComplete="off"
              disabled={pending}
              id="execution-app-token"
              type="password"
              value={token}
              onChange={handleTokenChange}
            />
            <p className="text-xs text-muted-foreground">
              使用独立的 App 凭据进行人工审批。Token 仅保留在当前会话内存中，断开后清除。
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            className="w-full"
            disabled={pending || !baseUrl.trim() || !token.trim()}
            type="submit"
          >
            {pending ? "验证身份与 v2 就绪状态…" : "连接工作台"}
          </Button>
        </form>
      </Card>
    </main>
  );
};
