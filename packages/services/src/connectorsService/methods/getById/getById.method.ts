import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { omitEncryptedConnectorCredentials } from "../../../capabilityHarvestService";
import { NotFoundError, toServiceError } from "../../../serviceErrors";
import type { ConnectorsDao } from "../../helpers/persistIfConfigUnchanged";

export const createGetByIdMethod = (dao: ConnectorsDao) => {
  return (id: string) =>
    ResultAsync.fromPromise(dao.findById(id), (error) => toServiceError(error, "Get connector"))
      .andThen((connector) =>
        connector ? okAsync(connector) : errAsync(new NotFoundError("Connector", id)),
      )
      .map(omitEncryptedConnectorCredentials);
};
