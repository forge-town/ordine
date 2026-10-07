import { initObs, initSpanRecorder } from "@repo/obs";

import {
  createAgentsDao,
  createOperationsDao,
  createJobsDao,
  createJobTracesDao,
  createSkillsDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  createSettingsDao,
  createAgentRuntimesDao,
  type DbConnection,
} from "@repo/models";
import { type JobLeaseTimingOptions } from "../jobLease";
import { createStartRunMethod } from "./methods";
import { createFailJobSafelyHelper, createBuildDepsForJobHelper } from "./helpers";
export const createOperationRunnerService = (
  db: DbConnection,
  jobLeaseOptions?: JobLeaseTimingOptions,
) => {
  const agentsDao = createAgentsDao(db);

  const operationsDao = createOperationsDao(db);

  const jobsDao = createJobsDao(db);

  const jobTracesDao = createJobTracesDao(db);

  const skillsDao = createSkillsDao(db);

  const agentRawExportsDao = createAgentRawExportsDao(db);

  const agentSpansDao = createAgentSpansDao(db);

  const settingsDao = createSettingsDao(db);

  const agentRuntimesDao = createAgentRuntimesDao(db);

  initObs(jobTracesDao);

  initSpanRecorder({ agentRawExportsDao, agentSpansDao });
  const failJobSafely = createFailJobSafelyHelper(jobsDao);
  const buildDepsForJob = createBuildDepsForJobHelper();

  return {
    startRun: createStartRunMethod(
      agentsDao,
      operationsDao,
      jobsDao,
      skillsDao,
      settingsDao,
      agentRuntimesDao,
      jobLeaseOptions,
      failJobSafely,
      buildDepsForJob,
    ),
  };
};
