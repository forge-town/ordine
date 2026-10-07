import type { createOperationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import type { createCapabilityCatalogService } from "../../../capabilityCatalogService";
import { toServiceError } from "../../../serviceErrors";

export const createCreateMethod =
  (
    dao: ReturnType<typeof createOperationsDao>,
    capabilityCatalog: ReturnType<typeof createCapabilityCatalogService>,
  ) =>
  (data: Parameters<typeof dao.create>[0]) =>
    capabilityCatalog
      .validateOperationInput({
        config: data.config === undefined ? {} : data.config,
        sourceSkillId: data.sourceSkillId,
      })
      .andThen(() =>
        ResultAsync.fromPromise(dao.create(data), (error) =>
          toServiceError(error, "Create operation"),
        ),
      )
      .map(withMeta);
