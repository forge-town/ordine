import { listMcpToolsHttp, listMcpToolsStdio } from "@repo/agent";
import { createConnectorsDao, type DbConnection } from "@repo/models";
import { isMcpConnectorConfig, type ConnectorConfig } from "@repo/schemas";
import { ResultAsync, err, errAsync, ok, okAsync, type Result } from "neverthrow";
import { ConflictError, NotFoundError, toServiceError } from "../serviceErrors";

type ConnectorsDao = ReturnType<typeof createConnectorsDao>;
type ConnectorRow = Awaited<ReturnType<ConnectorsDao["findById"]>>;
type Connector = NonNullable<ConnectorRow>;
type UpdateConnectorPatch = Parameters<ConnectorsDao["update"]>[1];
type ConnectorSnapshot = Pick<Connector, "method" | "config">;

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
  const next = denyManualConnected(patch);
  if (!next.config) return next;

  const config = { ...(next.config as Record<string, unknown>) };
  delete config.tools;
  delete config.lastError;

  return { ...next, config, status: "needs_setup", lastSyncAt: null };
};

const withLastError = (config: ConnectorConfig, lastError: string): Record<string, unknown> => ({
  ...(config as Record<string, unknown>),
  lastError,
});

/** Full structural comparison; both sides come from the same jsonb column. */
const sameConfig = (a: ConnectorConfig, b: ConnectorConfig): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const sameSnapshot = (a: ConnectorSnapshot, b: ConnectorSnapshot): boolean =>
  a.method === b.method && sameConfig(a.config, b.config);

const stripHandshakeArtifacts = (config: ConnectorConfig): Record<string, unknown> => {
  const next = { ...(config as Record<string, unknown>) };
  delete next.tools;
  delete next.lastError;

  return next;
};

export const createConnectorsService = (db: DbConnection) => {
  const dao = createConnectorsDao(db);

  const persistIfSnapshotUnchanged = async (
    id: string,
    snapshot: ConnectorSnapshot,
    patch: UpdateConnectorPatch,
    conflictMessage: string,
  ): Promise<Result<Connector, Error>> => {
    const updated = await dao.updateIfUnchanged(id, snapshot, patch);
    if (updated) return ok(updated);

    const current = await dao.findById(id);
    if (!current) return err(new NotFoundError("Connector", id));

    return err(new ConflictError(conflictMessage));
  };

  /**
   * Real connect. Failure taxonomy:
   * - not attemptable (non-mcp method, unconfigured/legacy config)
   *   -> status needs_setup + config.lastError
   * - valid config but handshake failed -> status error + config.lastError
   * Only a successful handshake sets connected and backfills tools + lastSyncAt.
   * A connector is **never** reported connected on failure or without a handshake.
   */
  const connectImpl = async (id: string): Promise<Result<Connector, Error>> => {
    const row = await dao.findById(id);
    if (!row) return err(new NotFoundError("Connector", id));
    const snapshot: ConnectorSnapshot = { method: row.method, config: row.config };

    const failSetup = async (message: string): Promise<Result<Connector, Error>> =>
      persistIfSnapshotUnchanged(
        id,
        snapshot,
        {
          status: "needs_setup",
          config: withLastError(stripHandshakeArtifacts(row.config), message),
        },
        "Connector configuration changed during handshake; connect again",
      ).then((result) =>
        result.isOk() ? err(toServiceError(new Error(message), "Connect connector")) : result,
      );

    // Only MCP connectors have a handshake; direct-api/built-in never connect here.
    if (row.method !== "mcp") {
      return failSetup(`method "${row.method}" does not support MCP handshake`);
    }

    const config = row.config;
    if (!isMcpConnectorConfig(config)) {
      return failSetup("Connector is not configured (set transport + command/url first).");
    }
    const handshake =
      config.transport === "stdio"
        ? await listMcpToolsStdio({
            command: config.command,
            args: config.args,
            env: config.env,
          })
        : await listMcpToolsHttp({
            url: config.url,
            headers: config.headers,
          });

    // Re-read before persisting: the connector may have been edited while the
    // handshake was in flight; a stale result must never overwrite fresh config.
    const current = await dao.findById(id);
    if (!current) return err(new NotFoundError("Connector", id));
    if (!sameSnapshot(current, snapshot)) {
      // Discard the stale handshake. The concurrent update() already reset the
      // status to needs_setup (sanitizeUpdatePatch), so nothing is written here.
      // ConflictError keeps 409 semantics: state changed concurrently, retry.
      return err(
        new ConflictError("Connector configuration changed during handshake; connect again"),
      );
    }

    if (handshake.isErr()) {
      const failed = await persistIfSnapshotUnchanged(
        id,
        snapshot,
        {
          status: "error",
          config: withLastError(stripHandshakeArtifacts(current.config), handshake.error),
        },
        "Connector configuration changed during handshake; connect again",
      );
      if (failed.isErr()) return failed;

      return err(toServiceError(new Error(handshake.error), "Connect connector"));
    }

    // Field-level merge on the freshly read config: only status/lastSyncAt plus
    // config.tools/lastError change; every other config field is preserved.
    const merged: Record<string, unknown> = {
      ...(current.config as Record<string, unknown>),
      tools: handshake.value,
    };
    delete merged.lastError;

    return persistIfSnapshotUnchanged(
      id,
      snapshot,
      {
        status: "connected",
        config: merged,
        lastSyncAt: new Date(),
      },
      "Connector configuration changed during handshake; connect again",
    );
  };

  const updateImpl = async (
    id: string,
    patch: UpdateConnectorPatch,
  ): Promise<Result<Connector, Error>> => {
    const sanitized = sanitizeUpdatePatch(patch);
    if (sanitized.method === undefined && sanitized.config === undefined) {
      const updated = await dao.update(id, sanitized);

      return updated ? ok(updated) : err(new NotFoundError("Connector", id));
    }

    const current = await dao.findById(id);
    if (!current) return err(new NotFoundError("Connector", id));

    const nextConfig = stripHandshakeArtifacts(
      (sanitized.config ?? current.config) as ConnectorConfig,
    );

    return persistIfSnapshotUnchanged(
      id,
      { method: current.method, config: current.config },
      {
        ...sanitized,
        status: "needs_setup",
        config: nextConfig,
        lastSyncAt: null,
      },
      "Connector changed while updating; retry",
    );
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
      ResultAsync.fromPromise(updateImpl(id, patch), (error) =>
        toServiceError(error, "Update connector"),
      ).andThen((result) => result),
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
