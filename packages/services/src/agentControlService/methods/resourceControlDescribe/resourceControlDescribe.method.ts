import { z } from "zod/v4";

import type { AgentResourceType } from "@repo/schemas";
import { ok, type Result } from "neverthrow";

import { createSchemas, updateSchemas, type ResourceControlBindings } from "../../contracts";
import type { ResourceControlError, ResourceControlValue } from "../../helpers/resourceControl";

export const createResourceControlDescribeMethod = (
  _serviceBindings: Pick<ResourceControlBindings, never>,
) =>
  ({
    describe(resourceType: AgentResourceType): Result<ResourceControlValue, ResourceControlError> {
      if (resourceType === "job") {
        return ok({
          resources: [],
          summary:
            "Jobs are read and controlled through execution tools; they are not generic writable resources.",
          data: { resourceType, create: null, update: null },
        });
      }
      const create = createSchemas[resourceType];
      const update = updateSchemas[resourceType];

      return ok({
        resources: [],
        summary: `Returned the compact ${resourceType} write contract.`,
        data: {
          resourceType,
          create: z.toJSONSchema(create, { target: "draft-07" }),
          update: z.toJSONSchema(update, { target: "draft-07" }),
        },
      });
    },
  }).describe;
