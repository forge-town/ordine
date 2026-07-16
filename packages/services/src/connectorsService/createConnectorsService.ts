import { listMcpToolsStdio } from "@repo/agent";
import { createConnectorsDao, type DbConnection } from "@repo/models";
import { isMcpConnectorConfig, type ConnectorConfig } from "@repo/schemas";
import { ResultAsync, err, errAsync, ok, okAsync, type Result } from "neverthrow";
import { NotFoundError, toServiceError } from "../serviceErrors";

type ConnectorRow = Awaited<ReturnType<ReturnType<typeof createConnectorsDao>["findById"]>>;
type Connector = NonNullable<ConnectorRow>;

/**
 * create/update must never set status to connected by hand — only a real
 * handshake (connect) may mark a connector connected (prevents fake-online state).
 */
const denyManualConnected = <T extends { status?: string | null }>(data: T): T =>
  data.status === "connected" ? { ...data, status: "needs_setup" } : data;

/**
 * Real handshake: probe the MCP server's tool list based on config.
 * Only stdio is supported for now; http transport is a follow-up (COD-245).
 */
const handshake = async (
  config: ConnectorConfig,
): Promise<Result<{ name: string; description?: string }[], string>> => {
  if (!isMcpConnectorConfig(config)) {
    return err("Connector is not configured (set transport + command/url first).");
  }
  if (config.transport === "stdio") {
    return listMcpToolsStdio({ command: config.command, args: config.args, env: config.env });
  }

  return err("http transport is not supported yet");
};

export const createConnectorsService = (db: DbConnection) => {
  const dao = createConnectorsDao(db);

  /**
   * Real connect: only a successful handshake sets status to connected and
   * backfills the discovered tools + lastSyncAt; a failure sets error + lastError.
   * A connector is **never** reported connected on failure or without a handshake.
   */
  const connect = async (id: string): Promise<Result<Connector, Error>> => {
    const row = await dao.findById(id);
    if (!row) return err(new NotFoundError("Connector", id));

    const config = row.config as ConnectorConfig;
    const result = await handshake(config);

    if (result.isErr()) {
      await dao.update(id, {
        status: "error",
        config: { ...(config as Record<string, unknown>), lastError: result.error },
      });

      return err(toServiceError(new Error(result.error), "Connect connector"));
    }

    const rest = { ...(config as Record<string, unknown>) };
    delete rest.lastError;
    const updated = await dao.update(id, {
      status: "connected",
      config: { ...rest, tools: result.value },
      lastSyncAt: new Date(),
    });
    if (!updated) return err(new NotFoundError("Connector", id));

    return ok(updated);
  };

  return {
    getAll: () =>
      ResultAsync.fromPromise(dao.findMany(), (error) => toServiceError(error, "Get connectors")),
    getById: (id: string) =>
      ResultAsync.fromPromise(dao.findById(id), (error) =>
        toServiceError(error, "Get connector"),
      ).andThen((connector) =>
        connector ? okAsync(connector) : errAsync(new NotFoundError("Connector", id)),
      ),
    create: (data: Parameters<typeof dao.create>[0]) =>
      ResultAsync.fromPromise(dao.create(denyManualConnected(data)), (error) =>
        toServiceError(error, "Create connector"),
      ),
    update: (id: string, patch: Parameters<typeof dao.update>[1]) =>
      ResultAsync.fromPromise(dao.update(id, denyManualConnected(patch)), (error) =>
        toServiceError(error, "Update connector"),
      ).andThen((connector) =>
        connector ? okAsync(connector) : errAsync(new NotFoundError("Connector", id)),
      ),
    connect,
    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) => toServiceError(error, "Delete connector")),
  };
};
