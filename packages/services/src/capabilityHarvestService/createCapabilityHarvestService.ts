import { homedir } from "node:os";
import { scanMcpCapabilities, scanSkillCapabilities } from "@repo/agent";
import {
  createCapabilityHarvestRepository,
  type CapabilityHarvestSummary,
  type DbConnection,
} from "@repo/models";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { toServiceError } from "../serviceErrors";
import { createCredentialCipher } from "./credentialCipher";
import { prepareCapabilityHarvest } from "./prepareCapabilityHarvest";

type McpScanner = typeof scanMcpCapabilities;
type SkillScanner = typeof scanSkillCapabilities;
type CapabilityHarvestRepository = ReturnType<typeof createCapabilityHarvestRepository>;

export interface CapabilityHarvestServiceOptions {
  encryptionSecret: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  scanMcp?: McpScanner;
  scanSkills?: SkillScanner;
  repository?: CapabilityHarvestRepository;
}

export interface CapabilityHarvestResult extends CapabilityHarvestSummary {
  mcpFiles: Awaited<ReturnType<McpScanner>>["files"];
  skillRoots: Awaited<ReturnType<SkillScanner>>["roots"];
  diagnostics: {
    mcp: Awaited<ReturnType<McpScanner>>["files"][number]["diagnostics"];
    skills: Awaited<ReturnType<SkillScanner>>["diagnostics"];
  };
}

export interface CapabilityHarvestInput {
  workspacePath?: string;
}

export const createCapabilityHarvestService = (
  db: DbConnection,
  options: CapabilityHarvestServiceOptions,
) => {
  const repository = options.repository ?? createCapabilityHarvestRepository(db);
  const scanMcp = options.scanMcp ?? scanMcpCapabilities;
  const scanSkills = options.scanSkills ?? scanSkillCapabilities;
  const cipher = createCredentialCipher(options.encryptionSecret);
  const context = {
    homeDir: options.homeDir ?? homedir(),
    env: options.env ?? process.env,
  };
  const automaticHarvestState: {
    completed?: CapabilityHarvestResult;
    inFlight?: ResultAsync<CapabilityHarvestResult, Error>;
  } = {};

  const harvest = ({
    workspacePath,
  }: CapabilityHarvestInput): ResultAsync<CapabilityHarvestResult, Error> => {
    if (cipher.isErr()) return errAsync(cipher.error);

    return ResultAsync.fromPromise(
      Promise.all([
        scanMcp({ ...context, ...(workspacePath ? { workspacePath } : {}) }),
        scanSkills({ ...context, ...(workspacePath ? { workspacePath } : {}) }),
      ]),
      (error) => toServiceError(error, "Scan runtime capabilities"),
    ).andThen(([mcpScan, skillScan]) => {
      const candidates = prepareCapabilityHarvest({
        mcpScan,
        skillScan,
        cipher: cipher.value,
        now: options.now?.() ?? new Date(),
      });
      if (candidates.isErr()) return errAsync(candidates.error);

      return ResultAsync.fromPromise(repository.sync(candidates.value), (error) =>
        toServiceError(error, "Sync runtime capabilities"),
      ).map((summary) => ({
        ...summary,
        mcpFiles: mcpScan.files,
        skillRoots: skillScan.roots,
        diagnostics: {
          mcp: mcpScan.files.flatMap((file) => file.diagnostics),
          skills: skillScan.diagnostics,
        },
      }));
    });
  };

  return {
    harvest,
    harvestOnce: (input: CapabilityHarvestInput) => {
      if (automaticHarvestState.completed) return okAsync(automaticHarvestState.completed);
      if (automaticHarvestState.inFlight) return automaticHarvestState.inFlight;

      const inFlight = harvest(input)
        .map((result) => {
          automaticHarvestState.completed = result;
          automaticHarvestState.inFlight = undefined;

          return result;
        })
        .mapErr((error) => {
          automaticHarvestState.inFlight = undefined;

          return error;
        });
      automaticHarvestState.inFlight = inFlight;

      return inFlight;
    },
  };
};
