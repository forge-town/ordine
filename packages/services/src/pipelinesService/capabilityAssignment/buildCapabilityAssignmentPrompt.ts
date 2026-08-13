import type { CapabilityAssignmentContext } from "./schemas";

export const CAPABILITY_ASSIGNMENT_SYSTEM_PROMPT = [
  "You assign one executor to every new or unmatched Pipeline operation.",
  "Return one JSON object only. Do not use Markdown or add commentary.",
  "Return exactly one assignment for each supplied operationId and no others.",
  "Prefer a script for deterministic local work such as moving files, converting formats, or calling a known API.",
  "Use an agent only when the step needs model judgment, a skill, or catalog tools.",
  "For agents, select agent/model only from AGENT_TARGETS.",
  "Use capability reference values, not catalog row ids.",
  "skillId must reference kind=skill. allowedTools may reference only builtin-tool or mcp-tool.",
  "Grant the smallest capability set needed by the step.",
  "assignmentReason is required inside executor, must be one line, and must explain the choice.",
  "If any selected capability is irreversible, assignmentReason must explicitly say why the irreversible action is necessary.",
].join("\n");

const projectPromptContext = (context: CapabilityAssignmentContext) => ({
  steps: context.steps,
  agentTargets: context.agentTargets,
  capabilityCatalog: context.capabilityCatalog.map((entry) => ({
    reference: entry.reference,
    displayName: entry.displayName,
    description: entry.description,
    kind: entry.kind,
    supportedRuntimes: entry.supportedRuntimes,
    riskTier: entry.riskTier,
  })),
});

const OUTPUT_EXAMPLES = {
  script: {
    operationId: "op_example_script",
    executor: {
      type: "script",
      language: "bash",
      command: "bun run lint",
      assignmentReason: "This deterministic local command needs no model or external capability.",
    },
  },
  promptAgent: {
    operationId: "op_example_review",
    executor: {
      type: "agent",
      agentMode: "prompt",
      agent: "claude-code",
      model: "example-model-id",
      prompt: "Review the supplied change and report actionable findings.",
      allowedTools: ["Read"],
      assignmentReason: "Read-only repository access is sufficient for semantic review.",
    },
  },
  skillAgent: {
    operationId: "op_example_skill",
    executor: {
      type: "agent",
      agentMode: "skill",
      agent: "claude-code",
      model: "example-model-id",
      skillId: "example-skill-reference",
      allowedTools: [],
      assignmentReason: "The selected skill covers the transformation without extra tools.",
    },
  },
};

export const buildCapabilityAssignmentPrompt = (context: CapabilityAssignmentContext): string =>
  [
    "=== ASSIGNMENT CONTEXT ===",
    JSON.stringify(projectPromptContext(context), null, 2),
    "",
    "=== OUTPUT EXAMPLES (shape only; do not copy ids or unavailable values) ===",
    JSON.stringify(OUTPUT_EXAMPLES, null, 2),
    "",
    'Return {"assignments":[...]} now.',
  ].join("\n");

export const buildCapabilityAssignmentRepairPrompt = (
  context: CapabilityAssignmentContext,
  invalidOutput: unknown,
  diagnostics: string[],
): string =>
  [
    "Repair the previous capability assignment once.",
    "Return the complete JSON object only. Fix every diagnostic and preserve valid intent.",
    "",
    "=== ASSIGNMENT CONTEXT ===",
    JSON.stringify(projectPromptContext(context), null, 2),
    "",
    "=== PREVIOUS INVALID OUTPUT ===",
    JSON.stringify(invalidOutput, null, 2),
    "",
    "=== VALIDATION DIAGNOSTICS ===",
    ...diagnostics.map((diagnostic) => `- ${diagnostic}`),
  ].join("\n");
