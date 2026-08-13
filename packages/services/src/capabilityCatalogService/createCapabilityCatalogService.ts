import {
  createCapabilityRiskOverridesDao,
  createConnectorsDao,
  createSkillsDao,
  type DbExecutor,
} from "@repo/models";
import {
  StrictOperationConfigSchema,
  type CapabilityCatalogEntry,
  type CapabilityCatalogValidationIssue,
  type GetCapabilityCatalogInput,
  type OperationConfig,
  type SetCapabilityRiskTierOverrideInput,
} from "@repo/schemas";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NotFoundError, ServiceError, toServiceError } from "../serviceErrors";
import { projectCapabilityCatalog } from "./catalogProjection";

type ConnectorsDao = ReturnType<typeof createConnectorsDao>;
type SkillsDao = ReturnType<typeof createSkillsDao>;
type RiskOverridesDao = ReturnType<typeof createCapabilityRiskOverridesDao>;

export interface CapabilityCatalogServiceDependencies {
  connectorsDao: Pick<ConnectorsDao, "findMany">;
  skillsDao: Pick<SkillsDao, "findMany" | "seedIfEmpty">;
  riskOverridesDao: Pick<RiskOverridesDao, "delete" | "findMany" | "upsert">;
}

export interface CapabilityCatalogServiceOptions {
  dependencies?: CapabilityCatalogServiceDependencies;
}

export interface OperationCapabilityValidationInput {
  config?: unknown;
  sourceSkillId?: unknown;
}

export interface OperationConfigShapeValidationIssue {
  path: string;
  message: string;
}

const capabilityValidationMessage = (issues: CapabilityCatalogValidationIssue[]): string => {
  const summaries = issues
    .slice(0, 3)
    .map((issue) =>
      issue.runtime
        ? `${issue.path}: ${issue.reference} is not available for ${issue.runtime}`
        : `${issue.path}: ${issue.reference}`,
    );
  const remainder =
    issues.length > summaries.length ? `; +${issues.length - summaries.length} more` : "";

  return `Invalid capability reference${issues.length === 1 ? "" : "s"}: ${summaries.join("; ")}${remainder}`;
};

export class CapabilityCatalogValidationError extends ServiceError {
  constructor(readonly issues: CapabilityCatalogValidationIssue[]) {
    super(capabilityValidationMessage(issues));
    this.name = "CapabilityCatalogValidationError";
  }
}

const operationConfigValidationMessage = (
  issues: OperationConfigShapeValidationIssue[],
): string => {
  const summaries = issues.slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`);
  const remainder =
    issues.length > summaries.length ? `; +${issues.length - summaries.length} more` : "";

  return `Invalid operation config${issues.length === 1 ? "" : "s"}: ${summaries.join("; ")}${remainder}`;
};

export class OperationConfigValidationError extends ServiceError {
  constructor(readonly issues: OperationConfigShapeValidationIssue[]) {
    super(operationConfigValidationMessage(issues));
    this.name = "OperationConfigValidationError";
  }
}

const filterCatalogEntries = (
  entries: CapabilityCatalogEntry[],
  input: GetCapabilityCatalogInput,
): CapabilityCatalogEntry[] => {
  const kinds = input.kinds ? new Set(input.kinds) : null;

  return entries.filter(
    (entry) =>
      (!input.runtime || entry.supportedRuntimes.includes(input.runtime)) &&
      (!kinds || kinds.has(entry.kind)),
  );
};

const extractValidationIssues = (
  config: OperationConfig,
  entries: CapabilityCatalogEntry[],
  pathPrefix = "config",
): CapabilityCatalogValidationIssue[] => {
  const executor = config.executor;
  if (!executor) return [];

  const issues: CapabilityCatalogValidationIssue[] = [];
  const runtime = executor.agent;
  const skillId = executor.skillId;
  if (
    typeof skillId === "string" &&
    !entries.some(
      (entry) =>
        entry.kind === "skill" &&
        entry.reference === skillId &&
        (!runtime || entry.supportedRuntimes.includes(runtime)),
    )
  ) {
    issues.push({
      path: `${pathPrefix}.executor.skillId`,
      reference: skillId,
      expectedKinds: ["skill"],
      ...(runtime ? { runtime } : {}),
    });
  }

  if (executor.allowedTools) {
    executor.allowedTools.forEach((reference, index) => {
      if (
        entries.some(
          (entry) =>
            (entry.kind === "builtin-tool" || entry.kind === "mcp-tool") &&
            entry.reference === reference &&
            (!runtime || entry.supportedRuntimes.includes(runtime)),
        )
      ) {
        return;
      }

      issues.push({
        path: `${pathPrefix}.executor.allowedTools[${index}]`,
        reference,
        expectedKinds: ["builtin-tool", "mcp-tool"],
        ...(runtime ? { runtime } : {}),
      });
    });
  }

  return issues;
};

const sourceSkillValidationIssues = (
  sourceSkillId: unknown,
  entries: CapabilityCatalogEntry[],
  path: string,
): CapabilityCatalogValidationIssue[] => {
  if (
    typeof sourceSkillId !== "string" ||
    entries.some((entry) => entry.kind === "skill" && entry.reference === sourceSkillId)
  ) {
    return [];
  }

  return [{ path, reference: sourceSkillId, expectedKinds: ["skill"] }];
};

type ValidationTarget = {
  config?: unknown;
  configPath?: string;
  sourceSkillId?: unknown;
  sourceSkillIdPath?: string;
};

type ParsedValidationTarget = Omit<ValidationTarget, "config"> & {
  config?: OperationConfig;
};

const appendZodPath = (prefix: string, segments: PropertyKey[]): string =>
  segments.reduce<string>(
    (path, segment) =>
      typeof segment === "number" ? `${path}[${segment}]` : `${path}.${String(segment)}`,
    prefix,
  );

const parseValidationTargets = (
  targets: ValidationTarget[],
): { parsedTargets: ParsedValidationTarget[]; issues: OperationConfigShapeValidationIssue[] } => {
  const issues: OperationConfigShapeValidationIssue[] = [];
  const parsedTargets = targets.map((target) => {
    const parsedTarget: ParsedValidationTarget = { ...target, config: undefined };
    if (target.configPath) {
      const parsed = StrictOperationConfigSchema.safeParse(target.config);
      if (parsed.success) {
        parsedTarget.config = parsed.data;
      } else {
        issues.push(
          ...parsed.error.issues.map((issue) => ({
            path: appendZodPath(target.configPath!, issue.path),
            message: issue.message,
          })),
        );
      }
    }

    if (
      target.sourceSkillIdPath &&
      target.sourceSkillId !== undefined &&
      target.sourceSkillId !== null &&
      typeof target.sourceSkillId !== "string"
    ) {
      issues.push({
        path: target.sourceSkillIdPath,
        message: "Expected a skill id string",
      });
    }

    return parsedTarget;
  });

  return { parsedTargets, issues };
};

export const createCapabilityCatalogService = (
  db: DbExecutor,
  options: CapabilityCatalogServiceOptions = {},
) => {
  const dependencies =
    options.dependencies ??
    ({
      connectorsDao: createConnectorsDao(db),
      skillsDao: createSkillsDao(db),
      riskOverridesDao: createCapabilityRiskOverridesDao(db),
    } satisfies CapabilityCatalogServiceDependencies);

  const loadEntries = (): ResultAsync<CapabilityCatalogEntry[], Error> =>
    ResultAsync.fromPromise(
      (async () => {
        await dependencies.skillsDao.seedIfEmpty();
        const [connectors, skills, overrides] = await Promise.all([
          dependencies.connectorsDao.findMany(),
          dependencies.skillsDao.findMany(),
          dependencies.riskOverridesDao.findMany(),
        ]);

        return projectCapabilityCatalog({ connectors, skills, overrides });
      })(),
      (error) => toServiceError(error, "Load capability catalog"),
    );

  const getMany = (input: GetCapabilityCatalogInput = {}) =>
    loadEntries().map((entries) => filterCatalogEntries(entries, input));

  const validateTargets = (targets: ValidationTarget[]): ResultAsync<void, Error> => {
    const { parsedTargets, issues: shapeIssues } = parseValidationTargets(targets);
    if (shapeIssues.length > 0) {
      return errAsync(new OperationConfigValidationError(shapeIssues));
    }

    return loadEntries().andThen((entries) => {
      const issues = parsedTargets.flatMap((target) => [
        ...(target.config && target.configPath
          ? extractValidationIssues(target.config, entries, target.configPath)
          : []),
        ...(target.sourceSkillIdPath
          ? sourceSkillValidationIssues(target.sourceSkillId, entries, target.sourceSkillIdPath)
          : []),
      ]);

      return issues.length > 0
        ? errAsync(new CapabilityCatalogValidationError(issues))
        : okAsync(undefined);
    });
  };

  const validateOperationConfigs = (configs: ReadonlyArray<unknown>): ResultAsync<void, Error> =>
    validateTargets(configs.map((config, index) => ({ config, configPath: `configs[${index}]` })));

  const validateOperationConfig = (config: unknown): ResultAsync<void, Error> =>
    validateTargets([{ config, configPath: "config" }]);

  const validateOperationInput = (
    input: OperationCapabilityValidationInput,
  ): ResultAsync<void, Error> =>
    validateTargets([
      {
        config: input.config,
        configPath: "config",
        sourceSkillId: input.sourceSkillId,
        sourceSkillIdPath: "sourceSkillId",
      },
    ]);

  const validateOperationInputs = (
    inputs: ReadonlyArray<OperationCapabilityValidationInput>,
  ): ResultAsync<void, Error> =>
    validateTargets(
      inputs.map((input, index) => ({
        config: input.config,
        configPath: `operations[${index}].config`,
        sourceSkillId: input.sourceSkillId,
        sourceSkillIdPath: `operations[${index}].sourceSkillId`,
      })),
    );

  const validateOperationPatch = (
    patch: OperationCapabilityValidationInput,
  ): ResultAsync<void, Error> =>
    validateTargets([
      {
        ...(Object.hasOwn(patch, "config") ? { config: patch.config, configPath: "config" } : {}),
        ...(Object.hasOwn(patch, "sourceSkillId")
          ? {
              sourceSkillId: patch.sourceSkillId,
              sourceSkillIdPath: "sourceSkillId",
            }
          : {}),
      },
    ]);

  const setRiskTierOverride = ({
    id,
    riskTier,
  }: SetCapabilityRiskTierOverrideInput): ResultAsync<CapabilityCatalogEntry, Error> =>
    loadEntries().andThen((entries) => {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return errAsync(new NotFoundError("Capability", id));

      const mutation: Promise<void> = riskTier
        ? dependencies.riskOverridesDao.upsert(id, riskTier).then(() => undefined)
        : dependencies.riskOverridesDao.delete(id);

      return ResultAsync.fromPromise(mutation, (error) =>
        toServiceError(error, "Set capability risk override"),
      ).map(() => ({
        ...entry,
        riskTier: riskTier ?? entry.inferredRiskTier,
        riskTierSource: riskTier ? ("override" as const) : ("rule" as const),
      }));
    });

  return {
    getMany,
    setRiskTierOverride,
    validateOperationConfig,
    validateOperationConfigs,
    validateOperationInput,
    validateOperationInputs,
    validateOperationPatch,
  };
};
