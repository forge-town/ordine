import type {
  createAgentRawExportsDao,
  createAgentSpansDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
  createSettingsDao,
} from "@repo/models";

import { runDistillation } from "../../helpers/runDistillation/runDistillation.helper";

export const createRunMethod =
  (
    distillationsDao: ReturnType<typeof createDistillationsDao>,
    jobsDao: ReturnType<typeof createJobsDao>,
    jobTracesDao: ReturnType<typeof createJobTracesDao>,
    agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>,
    agentSpansDao: ReturnType<typeof createAgentSpansDao>,
    pipelinesDao: ReturnType<typeof createPipelinesDao>,
    settingsDao: ReturnType<typeof createSettingsDao>,
  ) =>
  (id: string) =>
    runDistillation({
      id,
      distillationsDao,
      jobsDao,
      jobTracesDao,
      agentRawExportsDao,
      agentSpansDao,
      pipelinesDao,
      settingsDao,
    });
