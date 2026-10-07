import { ResultAsync, err, ok, type Result } from "neverthrow";
import { omitEncryptedConnectorCredentials } from "../../../capabilityHarvestService";
import { NotFoundError, toServiceError } from "../../../serviceErrors";

import { sanitizeUpdatePatch } from "../../helpers/sanitizeUpdatePatch";
import {
  type ConnectorsDao,
  type Connector,
  type UpdateConnectorPatch,
  persistIfConfigUnchanged,
} from "../../helpers/persistIfConfigUnchanged";
export const createUpdateMethod = (dao: ConnectorsDao) => {
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

  return (id: string, patch: UpdateConnectorPatch) =>
    ResultAsync.fromPromise(updateImpl(id, patch), (error) =>
      toServiceError(error, "Update connector"),
    )
      .andThen((result) => result)
      .map(omitEncryptedConnectorCredentials);
};
