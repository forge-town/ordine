import type { AgentResourceType } from "@repo/schemas";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlFindByIdHelper =
  (serviceBindings: Pick<ResourceControlBindings, "daos">) =>
  async (type: AgentResourceType, id: string): Promise<unknown | null> => {
    const value = await serviceBindings.daos[type].findById(id);

    return value ?? null;
  };
