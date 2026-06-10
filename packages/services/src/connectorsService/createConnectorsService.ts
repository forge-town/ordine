import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createConnectorsDao, type DbConnection } from "@repo/models";
import { NotFoundError, toServiceError } from "../serviceErrors";

export const createConnectorsService = (db: DbConnection) => {
  const dao = createConnectorsDao(db);

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
      ResultAsync.fromPromise(dao.create(data), (error) =>
        toServiceError(error, "Create connector"),
      ),
    update: (id: string, patch: Parameters<typeof dao.update>[1]) =>
      ResultAsync.fromPromise(dao.update(id, patch), (error) =>
        toServiceError(error, "Update connector"),
      ).andThen((connector) =>
        connector ? okAsync(connector) : errAsync(new NotFoundError("Connector", id)),
      ),
    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) => toServiceError(error, "Delete connector")),
  };
};
