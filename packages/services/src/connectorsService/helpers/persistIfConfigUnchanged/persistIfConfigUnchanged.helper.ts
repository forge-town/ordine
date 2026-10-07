import type { createConnectorsDao } from "@repo/models";

export type ConnectorsDao = ReturnType<typeof createConnectorsDao>;

export type ConnectorRow = Awaited<ReturnType<ConnectorsDao["findById"]>>;

export type Connector = NonNullable<ConnectorRow>;

export type UpdateConnectorPatch = Parameters<ConnectorsDao["update"]>[1];
import { err, ok, type Result } from "neverthrow";

import { ConflictError, NotFoundError } from "../../../serviceErrors";

export const persistIfConfigUnchanged = async (
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
