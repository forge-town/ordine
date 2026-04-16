export type LogLevel = "info" | "warn" | "error" | "debug";

export interface ObsDao {
  append: (jobId: string, message: string, level?: LogLevel) => Promise<unknown>;
}

let _dao: ObsDao | null = null;

export const initObs = (dao: ObsDao) => {
  _dao = dao;
};

export const trace = async (
  jobId: string,
  message: string,
  level: "info" | "warn" | "error" | "debug" = "info",
) => {
  if (!_dao) {
    throw new Error("obs not initialized — call initObs(dao) first");
  }
  await _dao.append(jobId, message, level);
};
