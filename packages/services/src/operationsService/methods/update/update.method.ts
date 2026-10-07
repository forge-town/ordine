import type { createOperationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { okAsync, ResultAsync } from "neverthrow";
import type { createCapabilityCatalogService } from "../../../capabilityCatalogService";
import { toServiceError } from "../../../serviceErrors";

export const createUpdateMethod =
  (
    dao: ReturnType<typeof createOperationsDao>,
    capabilityCatalog: ReturnType<typeof createCapabilityCatalogService>,
  ) =>
  (id: string, patch: Parameters<typeof dao.update>[1]) => {
    const validation =
      !Object.hasOwn(patch, "config") && !Object.hasOwn(patch, "sourceSkillId")
        ? okAsync(undefined)
        : capabilityCatalog.validateOperationPatch({
            ...(Object.hasOwn(patch, "config") ? { config: patch.config } : {}),
            ...(Object.hasOwn(patch, "sourceSkillId")
              ? { sourceSkillId: patch.sourceSkillId }
              : {}),
          });

    return validation
      .andThen(() =>
        ResultAsync.fromPromise(dao.update(id, patch), (error) =>
          toServiceError(error, "Update operation"),
        ),
      )
      .map(withMeta);
  };
