import { listMcpToolsHttp, listMcpToolsStdio } from "@repo/agent";
import { createConnectorsDao, type DbConnection } from "@repo/models";
import { isMcpConnectorConfig, type CapabilitySourceId, type ConnectorConfig } from "@repo/schemas";
import { ResultAsync, err, errAsync, ok, okAsync, type Result } from "neverthrow";
import {
  hydrateConnectorCredentials,
  omitEncryptedConnectorCredentials,
} from "../capabilityHarvestService";
import { ConflictError, NotFoundError, toServiceError } from "../serviceErrors";

type ConnectorsDao = ReturnType<typeof createConnectorsDao>;
type ConnectorRow = Awaited<ReturnType<ConnectorsDao["findById"]>>;
type Connector = NonNullable<ConnectorRow>;
type UpdateConnectorPatch = Parameters<ConnectorsDao["update"]>[1];

export interface ConnectorsServiceOptions {
  encryptionSecret?: string;
  env?: Readonly<Record<string, string | undefined>>;
}

export interface ConnectConnectorOptions {
  preferredSource?: CapabilitySourceId;
  sourceKey?: string;
}

/**
 * create/update must never set status to connected by hand — only a real
 * handshake (connect) may mark a connector connected (prevents fake-online state).
 */
const denyManualConnected = <T extends { status?: string | null }>(data: T): T =>
  data.status === "connected" ? { ...data, status: "needs_setup" } : data;

/**
 * A config or method edit invalidates any previous handshake: status falls back
 * to needs_setup, client-supplied tools are stripped, and lastSyncAt is cleared.
 * Only a real handshake (connect()) may backfill tools and lastSyncAt.
 */
const sanitizeUpdatePatch = (
  patch: UpdateConnectorPatch,
  current: Connector,
): UpdateConnectorPatch => {
  const sanitized = denyManualConnected(patch);
  const configChanged = sanitized.config !== undefined;
  const methodChanged = sanitized.method !== undefined && sanitized.method !== current.method;

  if (!configChanged && !methodChanged) return { ...sanitized, origin: "manual" };

  const config = configChanged
    ? { ...(sanitized.config as Record<string, unknown>) }
    : { ...(current.config as Record<string, unknown>) };
  delete config.tools;
  delete config.lastError;

  return {
    ...sanitized,
    config,
    status: "needs_setup",
    origin: "manual",
    signature: null,
    sources: [],
    encryptedCredentials: {},
    lastSyncAt: null,
  };
};

const withLastError = (config: ConnectorConfig, lastError: string): Record<string, unknown> => ({
  ...(config as Record<string, unknown>),
  lastError,
});

const stripHandshakeArtifacts = (config: ConnectorConfig): Record<string, unknown> => {
  const next = { ...(config as Record<string, unknown>) };
  delete next.tools;
  delete next.lastError;

  return next;
};

/** Full structural comparison; both sides come from the same jsonb column. */
const sameConfig = (a: ConnectorConfig, b: ConnectorConfig): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const persistIfConfigUnchanged = async (
  dao: ConnectorsDao,
  id: string,
  expected: Pick<Connector, "method" | "config">,
  patch: UpdateConnectorPatch,
  conflictMessage: string,
): Promise<Result<Connector, Error>> => {
  const updated = await dao.updateIfConfigUnchanged(id, patch, expected.method, expected.config);
  if (updated) return ok(updated);

  const current = await dao.findById(id);
  if (!current) return err(new NotFoundError("Connector", id));

  return err(new ConflictError(conflictMessage));
};

export const createConnectorsService = (
  db: DbConnection,
  options: ConnectorsServiceOptions = {},
) => {
  const dao = createConnectorsDao(db);

  /**
   * Real connect. Failure taxonomy:
   * - not attemptable (non-mcp method, unconfigured/legacy config)
   *   -> status needs_setup + config.lastError
   * - valid config but handshake failed -> status error + config.lastError
   * Only a successful handshake sets connected and backfills tools + lastSyncAt.
   * A connector is **never** reported connected on failure or without a handshake.
   */
  const connectImpl = async (
    id: string,
    connectOptions: ConnectConnectorOptions,
  ): Promise<Result<Connector, Error>> => {
    const row = await dao.findById(id);
    if (!row) return err(new NotFoundError("Connector", id));

    const failSetup = async (message: string): Promise<Result<Connector, Error>> =>
      persistIfConfigUnchanged(
        dao,
        id,
        row,
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

    if (!isMcpConnectorConfig(row.config)) {
      return failSetup("Connector is not configured (set transport + command/url first).");
    }

    const hydrated = hydrateConnectorCredentials(row, {
      ...(options.encryptionSecret === undefined
        ? {}
        : { encryptionSecret: options.encryptionSecret }),
      ...(options.env ? { env: options.env } : {}),
      ...connectOptions,
    });
    if (hydrated.isErr()) return failSetup(hydrated.error.message);
    const config = hydrated.value;
    if (!isMcpConnectorConfig(config)) {
      return failSetup("Connector is not configured (set transport + command/url first).");
    }

    const handshake =
      config.transport === "stdio"
        ? await listMcpToolsStdio({
            command: config.command,
            args: config.args,
            ...(config.cwd ? { cwd: config.cwd } : {}),
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
    if (current.method !== row.method || !sameConfig(current.config, row.config)) {
      // Discard the stale handshake. The concurrent update() already reset the
      // status to needs_setup (sanitizeUpdatePatch), so nothing is written here.
      // ConflictError keeps 409 semantics: state changed concurrently, retry.
      return err(
        new ConflictError("Connector configuration changed during handshake; connect again"),
      );
    }

    if (handshake.isErr()) {
      const failed = await persistIfConfigUnchanged(
        dao,
        id,
        row,
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

    return persistIfConfigUnchanged(
      dao,
      id,
      row,
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
    const current = await dao.findById(id);
    if (!current) return err(new NotFoundError("Connector", id));

    const sanitized = sanitizeUpdatePatch(patch, current);
    if (sanitized.method === undefined && sanitized.config === undefined) {
      const updated = await dao.update(id, sanitized);

      return updated ? ok(updated) : err(new NotFoundError("Connector", id));
    }

    return persistIfConfigUnchanged(
      dao,
      id,
      current,
      sanitized,
      "Connector changed while updating; retry",
    );
  };

  return {
    getAll: () =>
      ResultAsync.fromPromise(dao.findMany(), (error) =>
        toServiceError(error, "Get connectors"),
      ).map((connectors) => connectors.map(omitEncryptedConnectorCredentials)),
    getById: (id: string) =>
      ResultAsync.fromPromise(dao.findById(id), (error) => toServiceError(error, "Get connector"))
        .andThen((connector) =>
          connector ? okAsync(connector) : errAsync(new NotFoundError("Connector", id)),
        )
        .map(omitEncryptedConnectorCredentials),
    create: (data: Parameters<typeof dao.create>[0]) =>
      ResultAsync.fromPromise(dao.create(denyManualConnected(data)), (error) =>
        toServiceError(error, "Create connector"),
      ).map(omitEncryptedConnectorCredentials),
    update: (id: string, patch: UpdateConnectorPatch) =>
      ResultAsync.fromPromise(updateImpl(id, patch), (error) =>
        toServiceError(error, "Update connector"),
      )
        .andThen((result) => result)
        .map(omitEncryptedConnectorCredentials),
    /**
     * DAO/handshake rejections are normalized like every other method: callers
     * always receive a Result (isErr), never a rejected promise.
     */
    connect: (id: string, connectOptions: ConnectConnectorOptions = {}) =>
      ResultAsync.fromPromise(connectImpl(id, connectOptions), (error) =>
        toServiceError(error, "Connect connector"),
      )
        .andThen((result) => result)
        .map(omitEncryptedConnectorCredentials),
    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) => toServiceError(error, "Delete connector")),
  };
};
