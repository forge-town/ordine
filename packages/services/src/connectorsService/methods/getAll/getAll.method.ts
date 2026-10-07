import { ResultAsync } from "neverthrow";
import { omitEncryptedConnectorCredentials } from "../../../capabilityHarvestService";
import { toServiceError } from "../../../serviceErrors";
import type { ConnectorsDao } from "../../helpers/persistIfConfigUnchanged";

export const createGetAllMethod = (dao: ConnectorsDao) => {
  return () =>
    ResultAsync.fromPromise(dao.findMany(), (error) => toServiceError(error, "Get connectors")).map(
      (connectors) => connectors.map(omitEncryptedConnectorCredentials),
    );
};
