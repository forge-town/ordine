import type { AgentResourceType } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";

import type { ResourceControlError, ResourceControlValue } from "../../helpers/resourceControl";
import { domainError } from "../../helpers/resourceControlDomainError";
import { resourceRef } from "../../helpers/resourceControlResourceRef";
import { compactResource } from "../../helpers/resourceControlCompactResource";

import type { ResourceControlBindings } from "../../contracts";
export const createResourceControlGetMethod = (
  serviceBindings: Pick<ResourceControlBindings, "findById">,
) =>
  ({
    async get(
      resourceType: AgentResourceType,
      id: string,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const value = await (0, serviceBindings.findById)(resourceType, id);
      if (!value) {
        return err(domainError("RESOURCE_NOT_FOUND", `${resourceType}:${id} was not found`, true));
      }
      const compact = compactResource(resourceType, value);

      return ok({
        resources: [resourceRef(resourceType, compact)],
        summary: `Read ${resourceType}:${id}.`,
        data: { resource: compact },
      });
    },
  }).get;
