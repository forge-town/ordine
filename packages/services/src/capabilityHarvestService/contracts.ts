import type { scanMcpCapabilities, scanSkillCapabilities } from "@repo/agent";
import type { createCapabilityHarvestRepository, CapabilityHarvestSummary } from "@repo/models";
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
