import { listMcpToolsStdio } from "@repo/agent";
import { createConnectorsDao, type DbConnection } from "@repo/models";
import { isMcpConnectorConfig, type ConnectorConfig } from "@repo/schemas";
import { ResultAsync, err, errAsync, ok, okAsync, type Result } from "neverthrow";
import { ConflictError, NotFoundError, toServiceError } from "../serviceErrors";

type ConnectorsDao = ReturnType<typeof createConnectorsDao>;
type ConnectorRow = Awaited<ReturnType<ConnectorsDao["findById"]>>;
type Connector = NonNullable<ConnectorRow>;
type UpdateConnectorPatch = Parameters<ConnectorsDao["update"]>[1];

/**
 * create/update must never set status to connected by hand — only a real
 * handshake (connect) may mark a connector connected (prevents fake-online state).
 */
const denyManualConnected = <T extends { status?: string | null }>(data: T): T =>
  data.status === "connected" ? { ...data, status: "needs_setup" } : data;

/**
 * A config edit invalidates any previous handshake: status falls back to
 * needs_setup and client-supplied tools are stripped — the tool list may only
 * be backfilled by a real handshake (connect()).
 */
const sanitizeUpdatePatch = (patch: UpdateConnectorPatch): UpdateConnectorPatch => {
  if (!patch.config) return denyManualConnected(patch);

  const config = { ...(patch.config as Record<string, unknown>) };
  delete config.tools;

  return { ...patch, config, status: "needs_setup" };
};

const withLastError = (config: ConnectorConfig, lastError: string): Record<string, unknown> => ({
  ...(config as Record<string, unknown>),
  lastError,
});

/** Full structural comparison; both sides come from the same jsonb column. */
const sameConfig = (a: ConnectorConfig, b: ConnectorConfig): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const createConnectorsService = (db: DbConnection) => {
  const dao = createConnectorsDao(db);

  /**
   * Real connect. Failure taxonomy:
   * - not attemptable (non-mcp method, unconfigured/legacy config, http transport
   *   pending COD-245) -> status needs_setup + config.lastError
   * - valid config but handshake failed -> status error + config.lastError
   * Only a successful handshake sets connected and backfills tools + lastSyncAt.
   * A connector is **never** reported connected on failure or without a handshake.
   */
  const connectImpl = async (id: string): Promise<Result<Connector, Error>> => {
    const row = await dao.findById(id);
    if (!row) return err(new NotFoundError("Connector", id));

    const failSetup = async (message: string): Promise<Result<Connector, Error>> => {
      await dao.update(id, {
        status: "needs_setup",
        config: withLastError(row.config, message),
      });

      return err(toServiceError(new Error(message), "Connect connector"));
    };

    // Only MCP connectors have a handshake; direct-api/built-in never connect here.
    if (row.method !== "mcp") {
      return failSetup(`method "${row.method}" does not support MCP handshake`);
    }

    const config = row.config;
    if (!isMcpConnectorConfig(config)) {
      return failSetup("Connector is not configured (set transport + command/url first).");
    }
    if (config.transport === "http") {
      return failSetup("http transport is not supported yet");
    }

    const handshake = await listMcpToolsStdio({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    // Re-read before persisting: the connector may have been edited while the
    // handshake was in flight; a stale result must never overwrite fresh config.
    const current = await dao.findById(id);
    if (!current) return err(new NotFoundError("Connector", id));
    if (!sameConfig(current.config, config)) {
      // Discard the stale handshake. The concurrent update() already reset the
      // status to needs_setup (sanitizeUpdatePatch), so nothing is written here.
      // ConflictError keeps 409 semantics: state changed concurrently, retry.
      return err(
        new ConflictError("Connector configuration changed during handshake; connect again"),
      );
    }

    if (handshake.isErr()) {
      await dao.update(id, {
        status: "error",
        config: withLastError(current.config, handshake.error),
      });

      return err(toServiceError(new Error(handshake.error), "Connect connector"));
    }

    // Field-level merge on the freshly read config: only status/lastSyncAt plus
    // config.tools/lastError change; every other config field is preserved.
    const merged: Record<string, unknown> = {
      ...(current.config as Record<string, unknown>),
      tools: handshake.value,
    };
    delete merged.lastError;
    const updated = await dao.update(id, {
      status: "connected",
      config: merged,
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
    update: (id: string, patch: UpdateConnectorPatch) =>
      ResultAsync.fromPromise(dao.update(id, sanitizeUpdatePatch(patch)), (error) =>
        toServiceError(error, "Update connector"),
      ).andThen((connector) =>
        connector ? okAsync(connector) : errAsync(new NotFoundError("Connector", id)),
      ),
    /**
     * DAO/handshake rejections are normalized like every other method: callers
     * always receive a Result (isErr), never a rejected promise.
     */
    connect: (id: string): ResultAsync<Connector, Error> =>
      ResultAsync.fromPromise(connectImpl(id), (error) =>
        toServiceError(error, "Connect connector"),
      ).andThen((result) => result),
    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) => toServiceError(error, "Delete connector")),
  };
};
