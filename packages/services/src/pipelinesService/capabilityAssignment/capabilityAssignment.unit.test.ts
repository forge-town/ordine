import { describe, expect, it, vi } from "vitest";
import { buildMcpServerKey, buildMcpToolReference } from "../../connectorsService";
import { parseCapabilityAssignments } from "./parseCapabilityAssignments";
import { planCapabilityAssignments } from "./planCapabilityAssignments";
import type { CapabilityAssignmentContext } from "./schemas";
import { CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT } from "./buildCapabilityAssignmentPrompt";

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

  it("accepts a mixed script and agent plan", () => {
    const result = parseCapabilityAssignments(validOutput, context);

    expect(result.ok).toBe(true);
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.map((assignment) => assignment.executor.type)).toEqual([
      "script",
      "agent",
    ]);
  });

  it("accepts a skill-mode agent using the catalog reference as skillId", () => {
    const result = parseCapabilityAssignments(
      {
        assignments: [
          validOutput.assignments[0],
          {
            operationId: "op-review",
            executor: {
              type: "agent",
              agentMode: "skill",
              agent: "claude-code",
              model: "claude-review",
              skillId: "release-notes",
              allowedTools: [],
              assignmentReason: "The catalog skill provides the complete release-note workflow.",
            },
          },
        ],
      },
      context,
    );

    expect(result.ok).toBe(true);
  });

  it("rejects missing, duplicate, off-catalog, and extra assignments atomically", () => {
    const result = parseCapabilityAssignments(
      {
        assignments: [
          {
            operationId: "op-review",
            executor: {
              type: "agent",
              agentMode: "prompt",
              agent: "claude-code",
              model: "invented-model",
              prompt: "Review it.",
              allowedTools: ["invented-tool"],
              assignmentReason: "Review needs an agent.",
            },
          },
          {
            operationId: "op-review",
            executor: {
              type: "script",
              language: "bash",
              command: "echo duplicate",
              assignmentReason: "Duplicate fixture.",
            },
          },
          {
            operationId: "op-existing",
            executor: {
              type: "script",
              language: "bash",
              command: "echo no",
              assignmentReason: "Existing operations are out of scope.",
            },
          },
        ],
      },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.assignments).toEqual([]);
    expect(result.diagnostics.join("\n")).toContain("missing assignment");
    expect(result.diagnostics.join("\n")).toContain("duplicate operation assignment");
    expect(result.diagnostics.join("\n")).toContain("off-catalog agent/model pair");
    expect(result.diagnostics.join("\n")).toContain("off-catalog capability reference");
    expect(result.diagnostics.join("\n")).toContain("not new or unmatched");
  });

  it("requires an explicit explanation for irreversible capabilities", () => {
    const result = parseCapabilityAssignments(
      {
        assignments: [
          validOutput.assignments[0],
          {
            operationId: "op-review",
            executor: {
              type: "agent",
              agentMode: "prompt",
              agent: "claude-code",
              model: "claude-review",
              prompt: "Send the review.",
              allowedTools: [mailToolReference],
              assignmentReason: "Email the review to the team.",
            },
          },
        ],
      },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain(
      "assignments.op-review.executor.assignmentReason: an irreversible capability must be explicitly justified.",
    );
  });

  it("accepts the stable MCP reference when irreversible use is explicitly justified", () => {
    const result = parseCapabilityAssignments(
      {
        assignments: [
          validOutput.assignments[0],
          {
            operationId: "op-review",
            executor: {
              type: "agent",
              agentMode: "prompt",
              agent: "claude-code",
              model: "claude-review",
              prompt: "Send the completed review.",
              allowedTools: [mailToolReference],
              assignmentReason:
                "The irreversible email send is necessary to deliver the approved review.",
            },
          },
        ],
      },
      context,
    );

    expect(result.ok).toBe(true);
  });

  it("repairs once, then exposes only the complete repaired plan", async () => {
    const runAgent = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: { assignments: [validOutput.assignments[0]] } })
      .mockResolvedValueOnce({ ok: true, json: validOutput });

    const result = await planCapabilityAssignments({ context, runAgent });

    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(result.assignments).toHaveLength(2);
    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(runAgent.mock.calls[1]![0]).toContain("missing assignment for new operation");
    expect(runAgent.mock.calls[1]![0]).toContain("ASSIGNMENT CONTEXT");
  });

  it("returns no assignments when the only repair is still invalid", async () => {
    const invalid = { assignments: [validOutput.assignments[0]] };
    const runAgent = vi.fn().mockResolvedValue({ ok: true, json: invalid });

    const result = await planCapabilityAssignments({ context, runAgent });

    expect(result.ok).toBe(false);
    expect(result.assignments).toEqual([]);
    expect(result.attempts).toBe(2);
    expect(runAgent).toHaveBeenCalledTimes(2);
  });
});
