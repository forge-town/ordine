import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createAnnotationsDao, type DbConnection } from "@repo/models";
import { NotFoundError, toServiceError } from "../serviceErrors";

export const createAnnotationsService = (db: DbConnection) => {
  const dao = createAnnotationsDao(db);

  return {
    getAll: () =>
      ResultAsync.fromPromise(dao.getAll(), (error) => toServiceError(error, "Get annotations")),
    getById: (id: string) =>
      ResultAsync.fromPromise(dao.getById(id), (error) =>
        toServiceError(error, "Get annotation"),
      ).andThen((annotation) =>
        annotation ? okAsync(annotation) : errAsync(new NotFoundError("Annotation", id)),
      ),
    getByPipelineId: (pipelineId: string) =>
      ResultAsync.fromPromise(dao.getByPipelineId(pipelineId), (error) =>
        toServiceError(error, "Get annotations by pipeline"),
      ),
    getByTargetId: (targetId: string) =>
      ResultAsync.fromPromise(dao.getByTargetId(targetId), (error) =>
        toServiceError(error, "Get annotations by target"),
      ),
    create: (data: Parameters<typeof dao.create>[0]) =>
      ResultAsync.fromPromise(dao.create(data), (error) =>
        toServiceError(error, "Create annotation"),
      ),
    update: (id: string, patch: Parameters<typeof dao.update>[1]) =>
      ResultAsync.fromPromise(dao.update(id, patch), (error) =>
        toServiceError(error, "Update annotation"),
      ).andThen((annotation) =>
        annotation ? okAsync(annotation) : errAsync(new NotFoundError("Annotation", id)),
      ),
    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) =>
        toServiceError(error, "Delete annotation"),
      ),
  };
};
