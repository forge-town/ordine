export type LogLevel = "info" | "warn" | "error" | "debug";

export interface ObsDao {
  append: (jobId: string, message: string, level?: LogLevel) => Promise<unknown>;
}

const obsState = {
  dao: null as ObsDao | null,
};

export const initObs = (dao: ObsDao) => {
  obsState.dao = dao;
};

export const trace = async (
  jobId: string,
  message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
) => {
  if (!obsState.dao) {
    throw new Error("obs not initialized — call initObs(dao) first");
  }

  await obsState.dao.append(jobId, message, level);
};
