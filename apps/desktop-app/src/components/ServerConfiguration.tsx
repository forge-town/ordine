import { useState, type ChangeEvent } from "react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useDesktopSession } from "../integrations/sidecar/DesktopSessionContext";
import { retryNativeServer } from "../integrations/sidecar/server";

export const ServerConfiguration = () => {
  const { status } = useDesktopSession();
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [schema, setSchema] = useState("");
  const [initialize, setInitialize] = useState(false);
  const [saveConfiguration, setSaveConfiguration] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleDatabaseUrlChange = (event: ChangeEvent<HTMLInputElement>) =>
    setDatabaseUrl(event.target.value);
  const handleSchemaChange = (event: ChangeEvent<HTMLInputElement>) =>
    setSchema(event.target.value);
  const handleInitializeToggle = () => setInitialize(!initialize);
  const handleSaveToggle = () => setSaveConfiguration(!saveConfiguration);
  const handleRetry = () => {
    setPending(true);
    setError(null);
    void retryNativeServer(
      databaseUrl.trim()
        ? {
            databaseUrl: databaseUrl.trim(),
            schema: schema.trim() || "public",
            initialize,
            saveConfiguration,
          }
        : undefined,
    ).match(
      () => setPending(false),
      (failure) => {
        setError(failure.message);
        setPending(false);
      },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-xl space-y-5 p-5" variant="surface">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">ORDINE · Execution v2</p>
          <h1 className="text-xl font-semibold">连接专用执行数据库</h1>
          <p className="text-sm text-muted-foreground">
            使用新的 PostgreSQL 数据库或空 Schema。原有 Ordine 数据不会自动迁入。
          </p>
        </div>
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-destructive" role="alert">
          {error ?? status.error ?? "执行服务尚未就绪。请检查配置后重试。"}
        </p>
        <div className="space-y-2">
          <Label htmlFor="execution-database-url">PostgreSQL URL</Label>
          <Input
            autoComplete="off"
            id="execution-database-url"
            placeholder={
              status.databaseConfigured
                ? "留空以重试当前配置"
                : "postgres://用户@主机:端口/专用数据库"
            }
            type="password"
            value={databaseUrl}
            onChange={handleDatabaseUrlChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="execution-schema">Schema</Label>
          <Input
            id="execution-schema"
            placeholder="public"
            value={schema}
            onChange={handleSchemaChange}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-pressed={initialize}
            disabled={!databaseUrl}
            variant={initialize ? "default" : "outline"}
            onClick={handleInitializeToggle}
          >
            仅初始化空 Schema：{initialize ? "开启" : "关闭"}
          </Button>
          <Button
            aria-pressed={saveConfiguration}
            disabled={!databaseUrl}
            variant={saveConfiguration ? "default" : "outline"}
            onClick={handleSaveToggle}
          >
            保存供下次使用：{saveConfiguration ? "开启" : "关闭"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          默认仅本次使用。开启保存后，连接信息保存在独立 v2 目录中。
        </p>
        <Button
          className="w-full"
          disabled={pending || (!databaseUrl && !status.databaseConfigured)}
          onClick={handleRetry}
        >
          {pending ? "正在提交…" : "连接并重试"}
        </Button>
      </Card>
    </div>
  );
};
