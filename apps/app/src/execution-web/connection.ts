import { QueryClient } from "@tanstack/react-query";
import { createExecutionDataProvider } from "@repo/views/execution";
import { ExecutionReadinessSchema, type ExecutionReadiness } from "@repo/schemas";

export const connectExecution = async ({
  baseUrl,
  token,
  transport,
}: {
  baseUrl: string;
  token: string;
  transport: "bearer" | "desktop";
}) => {
  const normalized = baseUrl.trim().replace(/\/$/u, "");
  const provider = createExecutionDataProvider({
    baseUrl: normalized,
    getHeaders: () => {
      const headers = new Headers();
      headers.set(
        transport === "bearer" ? "Authorization" : "X-Desktop-Token",
        transport === "bearer" ? `Bearer ${token}` : token,
      );

      return headers;
    },
  });
  const response = await provider.getOne<ExecutionReadiness>({
    resource: "readiness",
    id: "current",
  });
  const readiness = ExecutionReadinessSchema.parse(response.data);
  if (readiness.status !== "ready") throw new Error("执行服务尚未就绪，请检查数据库 v2 状态");

  return {
    provider,
    readiness,
    baseUrl: normalized,
    recoveryKey: `${normalized}|${readiness.workspaceId}`,
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    }),
  };
};
export type ExecutionConnection = Awaited<ReturnType<typeof connectExecution>>;
