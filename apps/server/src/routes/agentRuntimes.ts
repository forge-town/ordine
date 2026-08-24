import { Hono, type Context } from "hono";
import { homedir } from "node:os";
import { extname, join, posix, win32 } from "node:path";
import { Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  createRuntimeCatalogCache,
  projectRuntimeCatalogFromConfigs,
  scanRuntimeCatalog,
} from "@repo/agent";
import { getLocalAgentRuntimeId, type AgentRuntimeConfig } from "@repo/schemas";
import {
  doctorMcpTarget,
  installMcpTarget,
  parseFormalMcpTargetId,
  statusMcpTarget,
  uninstallMcpTarget,
  type InstallContext,
  type McpLaunchSpec,
} from "@ordine/cli/mcp-manager";
import { agentRunsService, agentRuntimesService } from "../services.js";
import { getEnv } from "../integrations/env/index.js";

const connectionTestBodySchema = z.object({
  model: z.string().min(1).optional(),
  reasoningEffort: z.string().min(1).optional(),
  speed: z.string().min(1).optional(),
  cwd: z.string().min(1).optional(),
});
const mcpActionBodySchema = z.object({
  action: z.enum(["install", "status", "doctor", "uninstall"]),
});

const parseOptionalJsonBody = (context: Context) =>
  ResultAsync.fromPromise(
    context.req.text().then((body) => (body.trim().length > 0 ? JSON.parse(body) : {})),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );

export const agentRuntimesRoutes = new Hono();
const runtimeCatalogCache = createRuntimeCatalogCache({
  load: scanRuntimeCatalog,
  ttlMs: 60_000,
});
runtimeCatalogCache.warm();

const mergeRuntimeConfigIds = (
  catalog: Awaited<ReturnType<typeof scanRuntimeCatalog>>,
  runtimes: AgentRuntimeConfig[],
) =>
  catalog.map((entry) => ({
    ...entry,
    runtimeConfigId:
      runtimes.find(
        (runtime) => runtime.type === entry.runtime && runtime.connection.mode === "local",
      )?.id ?? entry.runtimeConfigId,
  }));

const getCatalog = async () => {
  const runtimes = await agentRuntimesService.getAll();
  const catalog = await runtimeCatalogCache.get(projectRuntimeCatalogFromConfigs(runtimes));

  return mergeRuntimeConfigIds(catalog, runtimes);
};

const rescanCatalog = async () => {
  const catalog = await runtimeCatalogCache.refresh();
  const configs = catalog.flatMap((entry): AgentRuntimeConfig[] => {
    if (!entry.path || entry.availability === "unavailable") return [];

    return [
      {
        id: getLocalAgentRuntimeId(entry.runtime),
        name: entry.displayName,
        type: entry.runtime,
        connection: {
          mode: "local",
          binaryName: entry.binaryName,
          path: entry.path,
          ...(entry.version ? { version: entry.version } : {}),
          models: entry.models,
          modelsSource: entry.modelsSource,
          detectedAt: new Date().toISOString(),
        },
        compatibility: entry.compatibility,
      },
    ];
  });
  const runtimes = await agentRuntimesService.syncAll(configs);

  return mergeRuntimeConfigIds(catalog, runtimes);
};

agentRuntimesRoutes.get("/catalog", async (context) => context.json(await getCatalog()));

agentRuntimesRoutes.post("/rescan", async (context) => context.json(await rescanCatalog()));

export const resolveDesktopMcpSidecarPath = (
  configuredPath: string | undefined,
  executablePath = process.execPath,
  platform: NodeJS.Platform = process.platform,
): string => {
  if (configuredPath) return configuredPath;
  const pathApi = platform === "win32" ? win32 : posix;
  const executableName = pathApi.basename(executablePath);
  const bundledSidecarName = /^ordine-server(?:-|\.)/i.test(executableName)
    ? executableName.replace(/^ordine-server/i, "ordine-mcp")
    : `ordine-mcp${platform === "win32" ? ".exe" : ""}`;

  return pathApi.join(pathApi.dirname(executablePath), bundledSidecarName);
};

agentRuntimesRoutes.post("/:id/connection-tests", async (context) => {
  const body = await parseOptionalJsonBody(context);
  if (body.isErr()) {
    return context.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }
  const parsed = connectionTestBodySchema.safeParse(body.value);
  if (!parsed.success) {
    return context.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }
  const runtimeConfigId = context.req.param("id");
  const prompt = "Reply with exactly ORDINE_CONNECTION_OK and nothing else.";
  const started = await ResultAsync.fromPromise(
    agentRunsService.start({
      owner: { type: "agent-runtime-connection-test", id: runtimeConfigId },
      runtimeConfigId,
      cwd: parsed.data.cwd ?? process.cwd(),
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
      ...(parsed.data.reasoningEffort ? { reasoningEffort: parsed.data.reasoningEffort } : {}),
      ...(parsed.data.speed ? { speed: parsed.data.speed } : {}),
      systemPrompt: "You are an ORDINE runtime connectivity probe.",
      prompt,
      rebuildPrompt: prompt,
      permissionMode: "read-only",
      networkAccess: true,
      fullAccessConfirmed: false,
      allowedTools: [],
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (started.isErr()) {
    return context.json(
      { code: "CONNECTION_TEST_START_FAILED", error: started.error.message },
      409,
    );
  }

  return context.json(started.value, 202);
});

agentRuntimesRoutes.post("/:id/mcp", async (context) => {
  const body = await parseOptionalJsonBody(context);
  const parsed = body.isOk() ? mcpActionBodySchema.safeParse(body.value) : null;
  if (!parsed?.success) {
    return context.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }
  const runtime = await agentRuntimesService.getById(context.req.param("id"));
  if (!runtime) return context.json({ code: "RUNTIME_NOT_FOUND", error: "Runtime not found" }, 404);
  const targetValue = runtime.type === "claude-code" ? "claude" : runtime.type;
  const targetResult = Result.fromThrowable(
    () => parseFormalMcpTargetId(targetValue),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )();
  if (targetResult.isErr()) {
    return context.json({ code: "MCP_TARGET_UNSUPPORTED", error: targetResult.error.message }, 409);
  }
  const target = targetResult.value;
  const env = getEnv();
  const copyCommand = `ordine mcp ${parsed.data.action} ${target}`;
  const token = context.req.header("X-Desktop-Token");
  if (!env.DESKTOP_MODE || !env.DESKTOP_AUTH_TOKEN || token !== env.DESKTOP_AUTH_TOKEN) {
    return context.json(
      {
        code: "MCP_DESKTOP_ONLY",
        error: "Global MCP client configuration is available only from authenticated Desktop mode.",
        copyCommand,
      },
      403,
    );
  }
  const sidecarPath = resolveDesktopMcpSidecarPath(env.ORDINE_MCP_SIDECAR_PATH);
  if (!extname(sidecarPath) && process.platform === "win32") {
    return context.json(
      { code: "MCP_SIDECAR_INVALID", error: "Desktop MCP sidecar path is invalid" },
      500,
    );
  }
  const dataDir = env.ORDINE_DATA_DIR ?? join(homedir(), ".ordine");
  const spec: McpLaunchSpec = {
    command: sidecarPath,
    args: ["--policy", "safe"],
    env: {
      ORDINE_API_URL: `http://127.0.0.1:${env.PORT ?? 9433}`,
      ORDINE_DESKTOP_AUTH_TOKEN_FILE: join(dataDir, ".desktop-token"),
    },
  };
  const installContext: InstallContext = {
    home: homedir(),
    cwd: process.cwd(),
    platform: process.platform,
    ...(process.env.APPDATA ? { appData: process.env.APPDATA } : {}),
    serverName: "ordine",
  };
  const operation =
    parsed.data.action === "install"
      ? installMcpTarget
      : parsed.data.action === "uninstall"
        ? uninstallMcpTarget
        : parsed.data.action === "doctor"
          ? doctorMcpTarget
          : statusMcpTarget;
  const result = await ResultAsync.fromPromise(
    operation({ target, spec, context: installContext }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (result.isErr()) {
    return context.json({ code: "MCP_OPERATION_FAILED", error: result.error.message }, 409);
  }

  return context.json(result.value);
});
