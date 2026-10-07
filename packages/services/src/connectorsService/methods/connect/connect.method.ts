import { listMcpToolsHttp, listMcpToolsStdio } from "@repo/agent";

import { isMcpConnectorConfig } from "@repo/schemas";
import { ResultAsync, err, type Result } from "neverthrow";
import {
  hydrateConnectorCredentials,
  omitEncryptedConnectorCredentials,
} from "../../../capabilityHarvestService";
import { ConflictError, NotFoundError, toServiceError } from "../../../serviceErrors";
import type { ConnectorsServiceOptions, ConnectConnectorOptions } from "../../contracts";

import { withLastError } from "../../helpers/withLastError";
import { stripHandshakeArtifacts } from "../../helpers/stripHandshakeArtifacts";
import { sameConfig } from "../../helpers/sameConfig";
import {
  type ConnectorsDao,
  type Connector,
  persistIfConfigUnchanged,
} from "../../helpers/persistIfConfigUnchanged";
export const createConnectMethod = (dao: ConnectorsDao, options: ConnectorsServiceOptions) => {
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

  return (id: string, connectOptions: ConnectConnectorOptions = {}) =>
    ResultAsync.fromPromise(connectImpl(id, connectOptions), (error) =>
      toServiceError(error, "Connect connector"),
    )
      .andThen((result) => result)
      .map(omitEncryptedConnectorCredentials);
};
