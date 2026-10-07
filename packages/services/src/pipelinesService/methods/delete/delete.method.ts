import "../../../text-imports.d.ts";

import type { PipelinesServiceBindings } from "../../contracts";
export const createDeleteMethod =
  (serviceBindings: Pick<PipelinesServiceBindings, "pipelineRunsDao" | "dao">) =>
  async (id: string) => {
    await serviceBindings.pipelineRunsDao.deleteByPipelineId(id);
    await serviceBindings.dao.delete(id);
  };
