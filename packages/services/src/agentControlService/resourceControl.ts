import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import {
  createAgentsDao,
  createConnectorsDao,
  createDistillationsDao,
  createJobsDao,
  createOperationsDao,
  createPipelineAssetsDao,
  createPipelinesDao,
  createProjectsDao,
  createRoutinesDao,
  createSkillsDao,
  type DbConnection,
} from "@repo/models";
import {
  AgentPatchSchema,
  AgentSchema,
  CreateConnectorSchema,
  CreateProjectSchema,
  CreateRoutineSchema,
  CreateSkillSchema,
  DistillationConfigSchema,
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  OperationSchema,
  PipelineStatusSchema,
  UpdateConnectorSchema,
  UpdateProjectSchema,
  UpdateRoutineSchema,
  UpdateSkillSchema,
  type AgentResourceRef,
  type AgentResourceType,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import { createAgentsService } from "../agentsService";
import { createConnectorsService } from "../connectorsService";
import { createDistillationsService } from "../distillationsService";
import { createOperationsService } from "../operationsService";
import { createPipelineAssetsService } from "../pipelineAssetsService";
import { createPipelinesService } from "../pipelinesService";
import { createProjectsService } from "../projectsService";
import { createRoutinesService } from "../routinesService";
import { createSkillsService } from "../skillsService";

const PipelineMetadataCreateSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
    projectId: z.string().min(1).nullable().optional(),
    name: z.string().min(1),
    description: z.string().default(""),
    sharedContext: z.string().default(""),
    status: PipelineStatusSchema.default("draft"),
    tags: z.array(z.string()).max(50).default([]),
    timeoutMs: z.number().int().positive().nullable().default(null),
  })
  .strict();

const PipelineMetadataUpdateSchema = PipelineMetadataCreateSchema.omit({ id: true }).partial();
const OperationCreateSchema = OperationSchema.omit({ meta: true });
const OperationUpdateSchema = OperationCreateSchema.omit({ id: true }).partial();
const AgentCreateSchema = AgentSchema.omit({ meta: true });
const DistillationCreateSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
    title: z.string().min(1),
    summary: z.string().default(""),
    sourceType: DistillationSourceTypeSchema.default("manual"),
    sourceId: z.string().min(1).nullable().default(null),
    sourceLabel: z.string().default(""),
    mode: DistillationModeSchema.default("pipeline"),
    config: DistillationConfigSchema.default({ objective: "" }),
  })
  .strict();
const DistillationUpdateSchema = DistillationCreateSchema.omit({ id: true }).partial();
const PipelineAssetCreateSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
    pipelineId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    tags: z.array(z.string().min(1)).min(1).max(50),
  })
  .strict();
const PipelineAssetUpdateSchema = PipelineAssetCreateSchema.omit({ id: true, pipelineId: true })
  .partial()
  .strict();

const createSchemas = {
  project: CreateProjectSchema.extend({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
  }).strict(),
  pipeline: PipelineMetadataCreateSchema,
  operation: OperationCreateSchema,
  skill: CreateSkillSchema.extend({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
  }).strict(),
  agent: AgentCreateSchema,
  connector: CreateConnectorSchema.extend({
    id: z
      .string()
      .min(1)
      .default(() => randomUUID()),
  }).strict(),
  routine: CreateRoutineSchema.and(
    z.object({
      id: z
        .string()
        .min(1)
        .default(() => randomUUID()),
    }),
  ),
  distillation: DistillationCreateSchema,
  "pipeline-asset": PipelineAssetCreateSchema,
} as const;

const updateSchemas = {
  project: UpdateProjectSchema.strict(),
  pipeline: PipelineMetadataUpdateSchema,
  operation: OperationUpdateSchema,
  skill: UpdateSkillSchema.strict(),
  agent: AgentPatchSchema.strict(),
  connector: UpdateConnectorSchema.strict(),
  routine: UpdateRoutineSchema,
  distillation: DistillationUpdateSchema,
  "pipeline-asset": PipelineAssetUpdateSchema,
} as const;

export type MutableAgentResourceType = keyof typeof createSchemas;

export type ResourceControlError = {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
};

export type ResourceControlValue = {
  resources: AgentResourceRef[];
  summary: string;
  data?: Record<string, unknown>;
  warnings?: string[];
};

const domainError = (
  code: string,
  message: string,
  retryable = false,
  field?: string,
): ResourceControlError => ({ code, message, retryable, ...(field ? { field } : {}) });

const validationError = (error: z.ZodError): ResourceControlError => {
  const issue = error.issues[0];

  return domainError(
    "INVALID_RESOURCE_FIELDS",
    issue?.message ?? "Resource fields are invalid",
    true,
    issue?.path.join(".") || undefined,
  );
};

const toError = (error: unknown, fallback: string): ResourceControlError =>
  domainError(
    "RESOURCE_OPERATION_FAILED",
    error instanceof Error ? error.message : fallback,
    false,
  );

const parseOffset = (cursor?: string): Result<number, ResourceControlError> => {
  if (!cursor) return ok(0);
  const value = Number.parseInt(cursor, 10);

  return Number.isSafeInteger(value) && value >= 0
    ? ok(value)
    : err(domainError("INVALID_CURSOR", "cursor must be a non-negative integer", true, "cursor"));
};

const labelFor = (value: Record<string, unknown>): string | undefined => {
  const candidate = value.name ?? value.title ?? value.label;

  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
};

const resourceRef = (
  type: AgentResourceType,
  value: Record<string, unknown>,
): AgentResourceRef => ({
  type,
  id: String(value.id),
  ...(labelFor(value) ? { label: labelFor(value) } : {}),
});

const serializeDates = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDates);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, serializeDates(child)]),
  );
};

const truncateValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => truncateValue(entry, depth + 1));
  }
  if (!value || typeof value !== "object" || depth >= 5) return value;

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 80)
      .map(([key, child]) => [key, truncateValue(child, depth + 1)]),
  );
};

const compactResource = (type: AgentResourceType, raw: unknown): Record<string, unknown> => {
  const value = (serializeDates(raw) ?? {}) as Record<string, unknown>;
  if (type === "pipeline") {
    const { nodes, edges, ...metadata } = value;

    return {
      ...metadata,
      nodeCount: Array.isArray(nodes) ? nodes.length : 0,
      edgeCount: Array.isArray(edges) ? edges.length : 0,
    };
  }
  if (type === "pipeline-asset") {
    const { snapshotNodes, snapshotEdges, inputSlots, ...metadata } = value;

    return {
      ...metadata,
      nodeCount: Array.isArray(snapshotNodes) ? snapshotNodes.length : 0,
      edgeCount: Array.isArray(snapshotEdges) ? snapshotEdges.length : 0,
      inputSlotCount: Array.isArray(inputSlots) ? inputSlots.length : 0,
    };
  }
  if (type === "connector") {
    const { config: _config, encryptedCredentials: _credentials, ...metadata } = value;

    return metadata;
  }
  if (type === "distillation") {
    const { inputSnapshot: _inputSnapshot, result: _result, ...metadata } = value;

    return metadata;
  }

  return truncateValue(value) as Record<string, unknown>;
};

const matchesQuery = (value: Record<string, unknown>, query: string): boolean => {
  if (query === "*") return true;
  const haystack = [value.id, value.name, value.title, value.label, value.description]
    .filter((entry): entry is string => typeof entry === "string")
    .join("\n")
    .toLocaleLowerCase();

  return haystack.includes(query.toLocaleLowerCase());
};

export const createResourceControl = (db: DbConnection) => {
  const daos = {
    project: createProjectsDao(db),
    pipeline: createPipelinesDao(db),
    operation: createOperationsDao(db),
    skill: createSkillsDao(db),
    agent: createAgentsDao(db),
    connector: createConnectorsDao(db),
    routine: createRoutinesDao(db),
    distillation: createDistillationsDao(db),
    "pipeline-asset": createPipelineAssetsDao(db),
    job: createJobsDao(db),
  } as const;
  const services = {
    project: createProjectsService(db),
    pipeline: createPipelinesService(db),
    operation: createOperationsService(db),
    skill: createSkillsService(db),
    agent: createAgentsService(db),
    connector: createConnectorsService(db),
    routine: createRoutinesService(db, {
      startRun: async () => err(new Error("Routine execution is owned by Agent Control")),
    }),
    distillation: createDistillationsService(db),
    "pipeline-asset": createPipelineAssetsService(db),
  } as const;

  const list = async (type: AgentResourceType): Promise<unknown[]> => {
    if (type === "job") return daos.job.findMany();

    return daos[type].findMany();
  };

  const findById = async (type: AgentResourceType, id: string): Promise<unknown | null> => {
    const value = await daos[type].findById(id);

    return value ?? null;
  };

  return {
    async search({
      query,
      resourceTypes,
      cursor,
      limit,
    }: {
      query: string;
      resourceTypes?: AgentResourceType[];
      cursor?: string;
      limit: number;
    }): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const offset = parseOffset(cursor);
      if (offset.isErr()) return err(offset.error);
      const types = resourceTypes ?? (Object.keys(daos) as AgentResourceType[]);
      const groups = await Promise.all(
        types.map(async (type) =>
          (await list(type))
            .map((entry) => compactResource(type, entry))
            .filter((entry) => matchesQuery(entry, query))
            .map((entry) => ({ type, entry })),
        ),
      );
      const all = groups.flat();
      const page = all.slice(offset.value, offset.value + limit);
      const nextOffset = offset.value + page.length;

      return ok({
        resources: page.map(({ type, entry }) => resourceRef(type, entry)),
        summary: `Found ${all.length} matching ORDINE resources; returned ${page.length}.`,
        data: {
          items: page.map(({ type, entry }) => ({ type, ...entry })),
          nextCursor: nextOffset < all.length ? String(nextOffset) : null,
          total: all.length,
        },
      });
    },

    async get(
      resourceType: AgentResourceType,
      id: string,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const value = await findById(resourceType, id);
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

    async create(
      resourceType: MutableAgentResourceType,
      data: Record<string, unknown>,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const parsed = createSchemas[resourceType].safeParse(data);
      if (!parsed.success) return err(validationError(parsed.error));

      if (resourceType === "pipeline") {
        const pipelineData = parsed.data as z.infer<typeof PipelineMetadataCreateSchema>;
        const created = await services.pipeline.create({
          ...pipelineData,
          nodes: [],
          edges: [],
        });
        const compact = compactResource(resourceType, created);

        return ok({
          resources: [resourceRef(resourceType, compact)],
          summary: `Created blank Pipeline ${created.id}; use Canvas tools to build its graph.`,
          data: { resource: compact },
        });
      }
      if (resourceType === "pipeline-asset") {
        const assetData = parsed.data as z.infer<typeof PipelineAssetCreateSchema>;
        const pipeline = await daos.pipeline.findById(assetData.pipelineId);
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
        const createdResult = await services[resourceType].create({
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

      const service = services[resourceType];
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

    async update(
      resourceType: MutableAgentResourceType,
      id: string,
      patch: Record<string, unknown>,
      expectedVersion?: number,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const parsed = updateSchemas[resourceType].safeParse(patch);
      if (!parsed.success) return err(validationError(parsed.error));
      if (resourceType === "pipeline") {
        const pipelinePatch = parsed.data as z.infer<typeof PipelineMetadataUpdateSchema>;
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
        const updated = await daos.pipeline.updateWithExpectedVersion(
          id,
          expectedVersion,
          pipelinePatch,
        );
        if (!updated) {
          const current = await daos.pipeline.findById(id);

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
      const result = await services[resourceType].update(id, parsed.data as never);
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

        return this.update("pipeline", id, { status: "archived" }, expectedVersion);
      }
      const updated = await services.routine.update(id, { enabled: false });
      if (updated.isErr()) return err(toError(updated.error, "Disable Routine"));
      const compact = compactResource(resourceType, updated.value);

      return ok({
        resources: [resourceRef(resourceType, compact)],
        summary: `Disabled Routine ${id}.`,
        data: { resource: compact },
      });
    },

    async delete(
      resourceType: MutableAgentResourceType,
      id: string,
    ): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const existing = await findById(resourceType, id);
      if (!existing) {
        return err(domainError("RESOURCE_NOT_FOUND", `${resourceType}:${id} was not found`, true));
      }
      const result = await services[resourceType].delete(id);
      if (result && typeof result === "object" && "isErr" in result) {
        const typed = result as Result<unknown, Error>;
        if (typed.isErr()) return err(toError(typed.error, `Delete ${resourceType}`));
      }

      return ok({
        resources: [resourceRef(resourceType, compactResource(resourceType, existing))],
        summary: `Permanently deleted ${resourceType}:${id}.`,
      });
    },

    async testConnector(id: string): Promise<Result<ResourceControlValue, ResourceControlError>> {
      const result = await services.connector.connect(id);
      if (result.isErr()) return err(toError(result.error, "Test Connector"));
      const compact = compactResource("connector", result.value);

      return ok({
        resources: [resourceRef("connector", compact)],
        summary: `Connector ${id} handshake succeeded.`,
        data: { resource: compact },
      });
    },
  };
};
