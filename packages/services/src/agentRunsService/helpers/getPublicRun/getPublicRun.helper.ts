import type { AgentRunRecord } from "@repo/db-schema";

import type { AgentRun } from "@repo/schemas";

import { toPublicRun } from "../toPublicRun";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createGetPublicRunHelper =
  (serviceBindings: Pick<AgentRunsServiceBindings, "ensureActivityProjection">) =>
  async (record: AgentRunRecord): Promise<AgentRun> =>
    toPublicRun(await (0, serviceBindings.ensureActivityProjection)(record));
