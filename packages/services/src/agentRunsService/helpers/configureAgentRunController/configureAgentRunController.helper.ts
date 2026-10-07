import { agentEngine, type AgentRunController } from "@repo/agent-engine";

/**
 * Configure the Agent Engine instance resolved inside @repo/services.
 *
 * Workspace package links can give an application and this package distinct
 * module instances on Windows. Calling this boundary avoids configuring only
 * the application's copy while Pipeline/Skill callers keep using an
 * unconfigured services copy.
 */
export const configureAgentRunController = (controller: AgentRunController | null): void => {
  agentEngine.setRunController(controller);
};
