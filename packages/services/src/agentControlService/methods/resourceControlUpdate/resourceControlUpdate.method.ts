import type { z } from "zod/v4";

import { err, ok, type Result } from "neverthrow";

import {
  type PipelineMetadataUpdateSchema,
  updateSchemas,
  type ResourceControlBindings,
} from "../../contracts";
import type {
  MutableAgentResourceType,
  ResourceControlError,
  ResourceControlValue,
} from "../../helpers/resourceControl";
import { domainError } from "../../helpers/resourceControlDomainError";
import { validationError } from "../../helpers/resourceControlValidationError";
import { toError } from "../../helpers/resourceControlToError";
import { resourceRef } from "../../helpers/resourceControlResourceRef";
import { compactResource } from "../../helpers/resourceControlCompactResource";

export const createResourceControlUpdateMethod = (
  serviceBindings: Pick<ResourceControlBindings, "daos" | "services">,
) =>
  ({
    async update(
      resourceType: MutableAgentResourceType,
      id: string,
      patch: Record<string, unknown>,
      expectedVersion?: number,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const parsed = updateSchemas[resourceType].safeParse(patch);
      if (!parsed.success) return err(validationError(parsed.error));
      // Zod defaults also run inside partial schemas. Omitted fields are not writes.
      const supplied = Object.fromEntries(
        Object.entries(parsed.data).filter(
          ([key]) => Object.hasOwn(patch, key) && patch[key] !== undefined,
        ),
      );
      if (resourceType === "pipeline") {
        const pipelinePatch = supplied as z.infer<typeof PipelineMetadataUpdateSchema>;
        if (!expectedVersion) {
          return err(
            domainError(
              "EXPECTED_VERSION_REQUIRED",
              "Pipeline metadata updates require expectedVersion",
              true,
              "expectedVersion",
            ),
          );
        }
        const updated = await serviceBindings.daos.pipeline.updateWithExpectedVersion(
          id,
          expectedVersion,
          pipelinePatch,
        );
        if (!updated) {
          const current = await serviceBindings.daos.pipeline.findById(id);

          return err(
            domainError(
              "VERSION_CONFLICT",
              current
                ? `Pipeline version is ${current.version}, expected ${expectedVersion}`
                : `pipeline:${id} was not found`,
              true,
              "expectedVersion",
            ),
          );
        }
        const compact = compactResource(resourceType, updated);

        return ok({
          resources: [resourceRef(resourceType, compact)],
          summary: `Updated Pipeline ${id} to version ${updated.version}.`,
          data: { resource: compact },
        });
      }
      const result = await serviceBindings.services[resourceType].update(id, supplied as never);
      if (result && typeof result === "object" && "isErr" in result) {
        const typed = result as Result<unknown, Error>;
        if (typed.isErr()) return err(toError(typed.error, `Update ${resourceType}`));
        const compact = compactResource(resourceType, typed.value);

        return ok({
          resources: [resourceRef(resourceType, compact)],
          summary: `Updated ${resourceType}:${id}.`,
          data: { resource: compact },
        });
      }
      if (!result)
        return err(domainError("RESOURCE_NOT_FOUND", `${resourceType}:${id} was not found`, true));
      const compact = compactResource(resourceType, result);

      return ok({
        resources: [resourceRef(resourceType, compact)],
        summary: `Updated ${resourceType}:${id}.`,
        data: { resource: compact },
      });
    },
  }).update;
