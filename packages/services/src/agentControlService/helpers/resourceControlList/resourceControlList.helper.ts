import type { AgentResourceType } from "@repo/schemas";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlListHelper =
  (serviceBindings: Pick<ResourceControlBindings, "daos">) =>
  async (type: AgentResourceType): Promise<unknown[]> => {
    if (type === "job") return serviceBindings.daos.job.findMany();

    return serviceBindings.daos[type].findMany();
  };
