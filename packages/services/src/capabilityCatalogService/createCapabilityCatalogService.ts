import {
  createCapabilityRiskOverridesDao,
  createConnectorsDao,
  createSkillsDao,
  type DbConnection,
} from "@repo/models";
import {
  AgentRuntimeSchema,
  type CapabilityCatalogEntry,
  type CapabilityCatalogValidationIssue,
  type GetCapabilityCatalogInput,
  type OperationConfigInput,
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
  config: OperationConfigInput | Record<string, unknown>,
  entries: CapabilityCatalogEntry[],
  pathPrefix = "config",
): CapabilityCatalogValidationIssue[] => {
  const executor = config.executor;
  if (!executor || typeof executor !== "object" || Array.isArray(executor)) return [];

  const executorConfig = executor as Record<string, unknown>;
  const issues: CapabilityCatalogValidationIssue[] = [];
  const runtimeResult = AgentRuntimeSchema.safeParse(executorConfig.agent);
  const runtime = runtimeResult.success ? runtimeResult.data : undefined;
  const skillId = executorConfig.skillId;
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

  const allowedTools = executorConfig.allowedTools;
  if (Array.isArray(allowedTools)) {
    allowedTools.forEach((reference, index) => {
      if (typeof reference !== "string") return;
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

export const createCapabilityCatalogService = (
  db: DbConnection,
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

  const validateOperationConfigs = (
    configs: ReadonlyArray<OperationConfigInput | Record<string, unknown>>,
  ): ResultAsync<void, Error> =>
    loadEntries().andThen((entries) => {
      const issues = configs.flatMap((config, index) =>
        extractValidationIssues(config, entries, `configs[${index}]`),
      );

      return issues.length > 0
        ? errAsync(new CapabilityCatalogValidationError(issues))
        : okAsync(undefined);
    });

  const validateOperationConfig = (
    config: OperationConfigInput | Record<string, unknown>,
  ): ResultAsync<void, Error> =>
    loadEntries().andThen((entries) => {
      const issues = extractValidationIssues(config, entries);

      return issues.length > 0
        ? errAsync(new CapabilityCatalogValidationError(issues))
        : okAsync(undefined);
    });

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
  };
};
