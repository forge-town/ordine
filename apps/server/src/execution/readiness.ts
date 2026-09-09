import type { Handler } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  ExecutionErrorSchema,
  ExecutionReadinessSchema,
  ORDINE_EXECUTION_API_VERSION,
  type ExecutionReadiness,
} from "@repo/schemas";
import type { ExecutionAuthEnv } from "./auth";

type ReadinessOptions = Pick<
  ExecutionReadiness,
  "buildRevision" | "instanceId" | "workspaceId" | "mode" | "limits"
> & {
  probeDatabase: (signal: AbortSignal) => Promise<ExecutionReadiness["database"]>;
  listLocalRuntimeIds: (signal: AbortSignal) => Promise<string[]>;
  dependencyTimeoutMs?: number;
};
const TimeoutSchema = z.number().int().min(1).max(10_000).default(1500);

const probeWithDeadline = async <T>(
  probe: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutError = new Error("Readiness dependency deadline exceeded");
  const pending = Promise.resolve().then(() => probe(controller.signal));
  const timer: { current?: ReturnType<typeof setTimeout> } = {};
  const timeout = new Promise<never>((_resolve, reject) => {
    timer.current = setTimeout(() => {
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });
  const result = await ResultAsync.fromPromise(Promise.race([pending, timeout]), (error) =>
    error === timeoutError ? "timeout" : "failed",
  );
  clearTimeout(timer.current);

  return result;
};

/** Authenticated readiness only. Public liveness is registered independently by the composition root. */
export const createExecutionReadinessHandler = (
  options: ReadinessOptions,
): Handler<ExecutionAuthEnv> => {
  const configuration = ExecutionReadinessSchema.safeParse({
    ordineApiVersion: ORDINE_EXECUTION_API_VERSION,
    graphSchemaVersion: ORDINE_EXECUTION_API_VERSION,
    buildRevision: options.buildRevision,
    instanceId: options.instanceId,
    workspaceId: options.workspaceId,
    mode: options.mode,
    status: "not_ready",
    database: { reachable: false, schemaVersion: null },
    capabilities: { valueTypes: ["text", "json", "artifact"], localAgentRuntimeIds: [] },
    limits: options.limits,
  });
  const timeout = TimeoutSchema.safeParse(options.dependencyTimeoutMs);

  return async (context) => {
    context.header("Cache-Control", "no-store");
    if (!configuration.success || !timeout.success)
      return context.json(
        {
          error: ExecutionErrorSchema.parse({
            code: "EXECUTION_READINESS_CONFIG_INVALID",
            message: "Execution readiness configuration is invalid.",
            retryable: false,
            stage: "validation",
          }),
        },
        500,
      );
    const [databaseProbe, runtimeProbe] = await Promise.all([
      probeWithDeadline(options.probeDatabase, timeout.data),
      probeWithDeadline(options.listLocalRuntimeIds, timeout.data),
    ]);
    const diagnostics: string[] = [];
    const database = ExecutionReadinessSchema.shape.database.safeParse(
      databaseProbe.isOk() ? databaseProbe.value : undefined,
    );
    const runtimeIds =
      ExecutionReadinessSchema.shape.capabilities.shape.localAgentRuntimeIds.safeParse(
        runtimeProbe.isOk() ? runtimeProbe.value : undefined,
      );
    if (!database.success)
      diagnostics.push(
        databaseProbe.isErr() && databaseProbe.error === "timeout"
          ? "DATABASE_PROBE_TIMEOUT"
          : "DATABASE_PROBE_UNAVAILABLE",
      );
    if (!runtimeIds.success)
      diagnostics.push(
        runtimeProbe.isErr() && runtimeProbe.error === "timeout"
          ? "RUNTIME_CATALOG_TIMEOUT"
          : "RUNTIME_CATALOG_UNAVAILABLE",
      );
    const databaseState = database.success
      ? database.data
      : { reachable: false, schemaVersion: null };
    const ready =
      databaseState.reachable && databaseState.schemaVersion === ORDINE_EXECUTION_API_VERSION;
    const response = ExecutionReadinessSchema.safeParse({
      ...configuration.data,
      status: ready ? "ready" : "not_ready",
      database: databaseState,
      capabilities: {
        ...configuration.data.capabilities,
        localAgentRuntimeIds: runtimeIds.success ? runtimeIds.data : [],
      },
    });
    if (!response.success)
      return context.json(
        {
          error: ExecutionErrorSchema.parse({
            code: "EXECUTION_READINESS_INVALID",
            message: "Execution readiness could not be represented.",
            retryable: false,
            stage: "validation",
          }),
        },
        500,
      );
    if (diagnostics.length > 0)
      context.header("X-Ordine-Readiness-Diagnostics", diagnostics.join(","));

    return context.json(response.data, ready ? 200 : 503);
  };
};
