import { ResultAsync } from "neverthrow";
import { omitEncryptedConnectorCredentials } from "../../../capabilityHarvestService";
import { toServiceError } from "../../../serviceErrors";
import type { ConnectorsDao } from "../../helpers/persistIfConfigUnchanged";
import { denyManualConnected } from "../../helpers/denyManualConnected";
export const createCreateMethod = (dao: ConnectorsDao) => {
  return (data: Parameters<typeof dao.create>[0]) =>
    ResultAsync.fromPromise(dao.create(denyManualConnected(data)), (error) =>
      toServiceError(error, "Create connector"),
    ).map(omitEncryptedConnectorCredentials);
};
