import "../../../text-imports.d.ts";

import type { PipelinesServiceBindings } from "../../contracts";
export const createGetAllMethod = (serviceBindings: Pick<PipelinesServiceBindings, "dao">) => () =>
  serviceBindings.dao.findMany();
