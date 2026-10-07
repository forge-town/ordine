import { describe, expect, it } from "vitest";

import { buildMcpServerKey, buildMcpToolReference } from "../../../connectorsService";

import type { CapabilityAssignmentContext } from "../../contracts";

import { CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT } from "./buildCapabilityAssignmentPrompt.helper";

const mailToolReference = buildMcpToolReference(buildMcpServerKey("mail"), "send");

const context = {
  steps: [
    { operationId: "op-lint", name: "Lint", description: "Lint source files" },
    { operationId: "op-review", name: "Review", description: "Review the resulting diff" },
  ],
  agentTargets: [{ agent: "claude-code", models: ["claude-review"] }],
  capabilityCatalog: [
    {
      id: "builtin:Read",
      reference: "Read",
      displayName: "Read",
      description: "Read files",
      source: "builtin",
      supportedRuntimes: ["claude-code"],
      riskTier: "readonly",
      inferredRiskTier: "readonly",
      riskTierSource: "rule",
      kind: "builtin-tool",
    },
    {
      id: "mcp:mail:send",
      reference: mailToolReference,
      displayName: "Send mail",
      description: "Send an email",
      source: "manual",
      supportedRuntimes: ["claude-code"],
      riskTier: "irreversible",
      inferredRiskTier: "irreversible",
      riskTierSource: "rule",
      kind: "mcp-tool",
      connectorId: "mail",
    },
    {
      id: "skill:release-notes",
      reference: "release-notes",
      displayName: "Release notes",
      description: "Create release notes from a supplied change set",
      source: "scanned",
      supportedRuntimes: ["claude-code"],
      riskTier: "readonly",
      inferredRiskTier: "readonly",
      riskTierSource: "rule",
      kind: "skill",
      skillId: "release-notes",
    },
  ],
} satisfies CapabilityAssignmentContext;

const validOutput = {
  assignments: [
    {
      operationId: "op-lint",
      executor: {
        type: "script",
        language: "bash",
        command: "bun run lint",
        assignmentReason: "Linting is a deterministic local command.",
      },
    },
    {
      operationId: "op-review",
      executor: {
        type: "agent",
        agentMode: "prompt",
        agent: "claude-code",
        model: "claude-review",
        prompt: "Review the supplied diff.",
        allowedTools: ["Read"],
        assignmentReason: "Semantic review needs model judgment and read-only access.",
      },
    },
  ],
};

describe("capability assignment", () => {
  it("requires generated artifact-transform prompts to preserve the complete result", () => {
    expect(CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT).toContain(
      "Each operation receives only its immediate parent output",
    );
    expect(CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT).toContain("complete resulting artifact");
  });
});
