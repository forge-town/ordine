import { homedir } from "node:os";
import { scanMcpCapabilities, scanSkillCapabilities } from "@repo/agent";
import { createCapabilityHarvestRepository, type DbConnection } from "@repo/models";
import type { ResultAsync } from "neverthrow";
import { createCredentialCipher } from "./helpers/credentialCipher";
import { createHarvestMethod, createHarvestOnceMethod } from "./methods";
import type { CapabilityHarvestServiceOptions, CapabilityHarvestResult } from "./contracts";
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
  const harvest = createHarvestMethod(repository, scanMcp, scanSkills, cipher, context, options);

  return { harvest, harvestOnce: createHarvestOnceMethod(automaticHarvestState, harvest) };
};
