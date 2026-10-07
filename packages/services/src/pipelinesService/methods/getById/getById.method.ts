import "../../../text-imports.d.ts";

import type { PipelinesServiceBindings } from "../../contracts";
export const createGetByIdMethod =
  (serviceBindings: Pick<PipelinesServiceBindings, "dao">) => (id: string) =>
    serviceBindings.dao.findById(id);
