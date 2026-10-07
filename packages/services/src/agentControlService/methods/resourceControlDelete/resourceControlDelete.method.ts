import { err, ok, type Result } from "neverthrow";

import type {
  MutableAgentResourceType,
  ResourceControlError,
  ResourceControlValue,
} from "../../helpers/resourceControl";
import { domainError } from "../../helpers/resourceControlDomainError";
import { toError } from "../../helpers/resourceControlToError";
import { resourceRef } from "../../helpers/resourceControlResourceRef";
import { compactResource } from "../../helpers/resourceControlCompactResource";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlDeleteMethod = (
  serviceBindings: Pick<ResourceControlBindings, "findById" | "services">,
) =>
  ({
    async delete(
      resourceType: MutableAgentResourceType,
      id: string,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const existing = await (0, serviceBindings.findById)(resourceType, id);
      if (!existing) {
        return err(domainError("RESOURCE_NOT_FOUND", `${resourceType}:${id} was not found`, true));
      }
      const result = await serviceBindings.services[resourceType].delete(id);
      if (result && typeof result === "object" && "isErr" in result) {
        const typed = result as Result<unknown, Error>;
        if (typed.isErr()) return err(toError(typed.error, `Delete ${resourceType}`));
      }

      return ok({
        resources: [resourceRef(resourceType, compactResource(resourceType, existing))],
        summary: `Permanently deleted ${resourceType}:${id}.`,
      });
    },
  }).delete;
