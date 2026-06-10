import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createRoutinesDao, type DbConnection } from "@repo/models";
import { NotFoundError, toServiceError } from "../serviceErrors";
import { getNextCronRunAt } from "../routineSchedulerService";

const withNextRunAt = <
  T extends { cronExpression?: string | null; enabled?: boolean; triggerType?: string },
>(
  data: T,
) => {
  if (data.enabled === false) {
    return { ...data, nextRunAt: null };
  }

  if (data.triggerType === "cron" && data.cronExpression) {
    return { ...data, nextRunAt: getNextCronRunAt(data.cronExpression, new Date()) };
  }

  return data;
};

export const createRoutinesService = (db: DbConnection) => {
  const dao = createRoutinesDao(db);

  return {
    getAll: () =>
      ResultAsync.fromPromise(dao.getAll(), (error) => toServiceError(error, "Get routines")),
    getById: (id: string) =>
      ResultAsync.fromPromise(dao.getById(id), (error) =>
        toServiceError(error, "Get routine"),
      ).andThen((routine) =>
        routine ? okAsync(routine) : errAsync(new NotFoundError("Routine", id)),
      ),
    getByPipelineId: (pipelineId: string) =>
      ResultAsync.fromPromise(dao.getByPipelineId(pipelineId), (error) =>
        toServiceError(error, "Get routines by pipeline"),
      ),
    getEnabled: () =>
      ResultAsync.fromPromise(dao.getEnabled(), (error) =>
        toServiceError(error, "Get enabled routines"),
      ),
    create: (data: Parameters<typeof dao.create>[0]) =>
      ResultAsync.fromPromise(dao.create(withNextRunAt(data)), (error) =>
        toServiceError(error, "Create routine"),
      ),
    update: (id: string, patch: Parameters<typeof dao.update>[1]) =>
      ResultAsync.fromPromise(dao.update(id, withNextRunAt(patch)), (error) =>
        toServiceError(error, "Update routine"),
      ).andThen((routine) =>
        routine ? okAsync(routine) : errAsync(new NotFoundError("Routine", id)),
      ),
    delete: (id: string) =>
      ResultAsync.fromPromise(dao.delete(id), (error) => toServiceError(error, "Delete routine")),
  };
};
