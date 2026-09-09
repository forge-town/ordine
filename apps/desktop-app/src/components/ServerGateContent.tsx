import type { ReactNode } from "react";
import { useDesktopSession } from "../integrations/sidecar/DesktopSessionContext";
import { ServerConfiguration } from "./ServerConfiguration";

export const ServerGateContent = ({ children }: { children: ReactNode }) => {
  const { status, credentials } = useDesktopSession();
  if (status.phase === "failed" || status.phase === "idle" || status.phase === "stopped")
    return <ServerConfiguration />;
  if (status.phase !== "ready" || !credentials) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground"
        role="status"
      >
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-semibold">
            {status.phase === "stopping" ? "正在停止执行任务" : "正在启动执行服务"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {status.phase === "stopping"
              ? "请等待当前实例的任务完成清理，最长约 35 秒。"
              : "正在检查实例身份与专用数据库。"}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
