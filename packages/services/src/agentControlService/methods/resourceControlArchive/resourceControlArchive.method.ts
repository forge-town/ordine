import type { createResourceControlUpdateMethod } from "../resourceControlUpdate";
import { err, ok, type Result } from "neverthrow";

import type { ResourceControlError, ResourceControlValue } from "../../helpers/resourceControl";
import { domainError } from "../../helpers/resourceControlDomainError";
import { toError } from "../../helpers/resourceControlToError";
import { resourceRef } from "../../helpers/resourceControlResourceRef";
import { compactResource } from "../../helpers/resourceControlCompactResource";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlArchiveMethod = (
  serviceBindings: Pick<ResourceControlBindings, "services">,
) =>
  ({
    async archive(
      resourceType: "pipeline" | "routine",
      id: string,
      expectedVersion?: number,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      if (resourceType === "pipeline") {
        if (!expectedVersion) {
          return err(
            domainError(
              "EXPECTED_VERSION_REQUIRED",
              "Archiving a Pipeline requires expectedVersion",
              true,
              "expectedVersion",
            ),
          );
        }

        return (
          this as unknown as { update: ReturnType<typeof createResourceControlUpdateMethod> }
        ).update("pipeline", id, { status: "archived" }, expectedVersion);
      }
      const updated = await serviceBindings.services.routine.update(id, { enabled: false });
      if (updated.isErr()) return err(toError(updated.error, "Disable Routine"));
      const compact = compactResource(resourceType, updated.value);

      return ok({
        resources: [resourceRef(resourceType, compact)],
        summary: `Disabled Routine ${id}.`,
        data: { resource: compact },
      });
    },
  }).archive;
