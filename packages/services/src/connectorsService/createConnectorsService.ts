import { listMcpToolsStdio } from "@repo/agent";
import { createConnectorsDao, type DbConnection } from "@repo/models";
import { isMcpConnectorConfig, type ConnectorConfig } from "@repo/schemas";
import { ResultAsync, err, errAsync, ok, okAsync, type Result } from "neverthrow";
import { NotFoundError, toServiceError } from "../serviceErrors";

type ConnectorRow = Awaited<ReturnType<ReturnType<typeof createConnectorsDao>["getById"]>>;
type Connector = NonNullable<ConnectorRow>;

/** create/update 不允许把 status 手设成 connected——只有真握手（connect）才能置 connected（防 CONN-01 假态）。 */
const denyManualConnected = <T extends { status?: string | null }>(data: T): T =>
  data.status === "connected" ? { ...data, status: "needs_setup" } : data;

export const createConnectorsService = (db: DbConnection) => {
  const dao = createConnectorsDao(db);

  /** 真握手：按 config 探测 MCP server 工具列表。目前支持 stdio；http 留待后续。 */
  const handshake = async (
    config: ConnectorConfig,
  ): Promise<Result<{ name: string; description?: string }[], string>> => {
    if (!isMcpConnectorConfig(config)) {
      return err("Connector is not configured (set transport + command/url first).");
    }
    if (config.transport === "stdio") {
      return listMcpToolsStdio({ command: config.command, args: config.args, env: config.env });
    }

    return err("http transport is not supported yet (N22 follow-on).");
  };

  /**
   * 真连接：握手成功才把 status 落 connected 并回填真工具与 lastSyncAt；
   * 失败落 error + lastError。**绝不**在失败/未握手时报 connected。
   */
  const connect = async (id: string): Promise<Result<Connector, Error>> => {
    const row = await dao.getById(id);
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
      ResultAsync.fromPromise(dao.getAll(), (error) => toServiceError(error, "Get connectors")),
    getById: (id: string) =>
      ResultAsync.fromPromise(dao.getById(id), (error) =>
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
