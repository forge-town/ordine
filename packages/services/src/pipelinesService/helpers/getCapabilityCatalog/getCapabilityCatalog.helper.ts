import "../../../text-imports.d.ts";

import type { DbExecutor } from "@repo/models";

import { createCapabilityCatalogService } from "../../../capabilityCatalogService";

import type { PipelinesServiceBindings } from "../../contracts";
export const createGetCapabilityCatalogHelper =
  (serviceBindings: Pick<PipelinesServiceBindings, "options">) => (executor: DbExecutor) =>
    serviceBindings.options.capabilityCatalog ??
    createCapabilityCatalogService(executor, serviceBindings.options.capabilityCatalogOptions);
