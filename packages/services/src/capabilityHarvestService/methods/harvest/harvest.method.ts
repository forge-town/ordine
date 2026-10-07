import type { scanMcpCapabilities, scanSkillCapabilities } from "@repo/agent";
import type { createCapabilityHarvestRepository } from "@repo/models";
import { errAsync, ResultAsync } from "neverthrow";
import type {
  CapabilityHarvestInput,
  CapabilityHarvestResult,
  CapabilityHarvestServiceOptions,
} from "../../contracts";
import type { createCredentialCipher } from "../../helpers/credentialCipher";
import { prepareCapabilityHarvest } from "../../helpers/prepareCapabilityHarvest";
import { toServiceError } from "../../../serviceErrors";
export const createHarvestMethod =
  (
    repository: ReturnType<typeof createCapabilityHarvestRepository>,
    scanMcp: typeof scanMcpCapabilities,
    scanSkills: typeof scanSkillCapabilities,
    cipher: ReturnType<typeof createCredentialCipher>,
    context: { homeDir: string; env: NodeJS.ProcessEnv },
    options: CapabilityHarvestServiceOptions,
  ) =>
  ({ workspacePath }: CapabilityHarvestInput): ResultAsync<CapabilityHarvestResult, Error> => {
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
