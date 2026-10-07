import type { z } from "zod/v4";

import { err, ok, type Result } from "neverthrow";

import {
  type PipelineMetadataCreateSchema,
  type PipelineAssetCreateSchema,
  createSchemas,
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

export const createResourceControlCreateMethod = (
  serviceBindings: Pick<ResourceControlBindings, "services" | "daos">,
) =>
  ({
    async create(
      resourceType: MutableAgentResourceType,
      data: Record<string, unknown>,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const parsed = createSchemas[resourceType].safeParse(data);
      if (!parsed.success) return err(validationError(parsed.error));

      if (resourceType === "pipeline") {
        const pipelineData = parsed.data as z.infer<typeof PipelineMetadataCreateSchema>;
        const createdResult = await serviceBindings.services.pipeline.create({
          ...pipelineData,
          nodes: [],
          edges: [],
        });
        if (createdResult.isErr()) {
          return err(toError(createdResult.error, "Create Pipeline"));
        }
        const created = createdResult.value;
        const compact = compactResource(resourceType, created);

        return ok({
          resources: [resourceRef(resourceType, compact)],
          summary: `Created blank Pipeline ${created.id}; use Canvas tools to build its graph.`,
          data: { resource: compact },
        });
      }
      if (resourceType === "pipeline-asset") {
        const assetData = parsed.data as z.infer<typeof PipelineAssetCreateSchema>;
        const pipeline = await serviceBindings.daos.pipeline.findById(assetData.pipelineId);
        if (!pipeline) {
          return err(
            domainError(
              "RESOURCE_NOT_FOUND",
              `pipeline:${assetData.pipelineId} was not found`,
              true,
              "pipelineId",
            ),
          );
        }
        if (pipeline.nodes.length === 0) {
          return err(
            domainError(
              "EMPTY_PIPELINE",
              "A Pipeline Asset requires at least one Canvas node",
              true,
              "pipelineId",
            ),
          );
        }
        const createdResult = await serviceBindings.services[resourceType].create({
          ...assetData,
          snapshotNodes: pipeline.nodes,
          snapshotEdges: pipeline.edges,
          inputSlots: [],
        });
        if (createdResult.isErr())
          return err(toError(createdResult.error, "Create Pipeline Asset"));
        const compact = compactResource(resourceType, createdResult.value);

        return ok({
          resources: [resourceRef(resourceType, compact)],
          summary: `Created Pipeline Asset ${assetData.id} from Pipeline ${pipeline.id}.`,
          data: { resource: compact },
        });
      }

      const service = serviceBindings.services[resourceType];
      const result = await service.create(parsed.data as never);
      if (result && typeof result === "object" && "isErr" in result) {
        const typed = result as Result<unknown, Error>;
        if (typed.isErr()) return err(toError(typed.error, `Create ${resourceType}`));
        const compact = compactResource(resourceType, typed.value);

        return ok({
          resources: [resourceRef(resourceType, compact)],
          summary: `Created ${resourceType}:${String((compact as { id?: unknown }).id)}.`,
          data: { resource: compact },
        });
      }
      const compact = compactResource(resourceType, result);

      return ok({
        resources: [resourceRef(resourceType, compact)],
        summary: `Created ${resourceType}:${String((compact as { id?: unknown }).id)}.`,
        data: { resource: compact },
      });
    },
  }).create;
