import { ResultAsync } from "neverthrow";

import { toServiceError } from "../../../serviceErrors";
import type { ConnectorsDao } from "../../helpers/persistIfConfigUnchanged";

export const createDeleteMethod = (dao: ConnectorsDao) => {
  return (id: string) =>
    ResultAsync.fromPromise(dao.delete(id), (error) => toServiceError(error, "Delete connector"));
};
