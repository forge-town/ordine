import type { AssignedOperationExecutorConfig } from "@repo/schemas";
import type { ZodError } from "zod/v4";
import {
  CapabilityAssignmentOutputSchema,
  type CapabilityAssignmentContext,
  type CapabilityAssignmentParseResult,
  type PerStepCapabilityAssignment,
} from "./schemas";

const formatZodIssues = (error: ZodError): string[] =>
  error.issues.map((issue) => `output.${issue.path.join(".") || "(root)"}: ${issue.message}`);

const fail = (diagnostics: string[]): CapabilityAssignmentParseResult => ({
  ok: false,
  assignments: [],
  diagnostics,
});

const selectedCapabilities = (
  executor: AssignedOperationExecutorConfig,
): Array<{ path: string; reference: string; expectedKind: "skill" | "tool" }> => {
  if (executor.type === "script") return [];

  const tools = executor.allowedTools.map((reference, index) => ({
    path: `allowedTools[${index}]`,
    reference,
    expectedKind: "tool" as const,
  }));

  return executor.agentMode === "skill"
    ? [
        {
          path: "skillId",
          reference: executor.skillId,
          expectedKind: "skill" as const,
        },
        ...tools,
      ]
    : tools;
};

const IRREVERSIBLE_EXPLANATION_PATTERN =
  /irreversible|cannot be undone|permanent|不可逆|不可撤销|无法撤销/u;

export const validateAssignedOperationExecutor = (input: {
  executor: AssignedOperationExecutorConfig;
  context: Pick<CapabilityAssignmentContext, "agentTargets" | "capabilityCatalog">;
  pathPrefix: string;
}): string[] => {
  const { context, executor, pathPrefix: prefix } = input;
  const diagnostics: string[] = [];
  if (executor.type === "script") return diagnostics;

  const target = context.agentTargets.find((candidate) => candidate.agent === executor.agent);
  if (!target || !target.models.includes(executor.model)) {
    diagnostics.push(
      `${prefix}.model: off-catalog agent/model pair "${executor.agent}/${executor.model}".`,
    );
  }

  const capabilities = selectedCapabilities(executor);
  const references = capabilities.map((capability) => capability.reference);
  const duplicate = references.find((reference, index) => references.indexOf(reference) !== index);
  if (duplicate) {
    diagnostics.push(`${prefix}: duplicate capability reference "${duplicate}".`);
  }

  for (const capability of capabilities) {
    const entry = context.capabilityCatalog.find(
      (candidate) => candidate.reference === capability.reference,
    );
    const path = `${prefix}.${capability.path}`;
    if (!entry) {
      diagnostics.push(`${path}: off-catalog capability reference "${capability.reference}".`);
      continue;
    }

    const kindMatches =
      capability.expectedKind === "skill"
        ? entry.kind === "skill"
        : entry.kind === "builtin-tool" || entry.kind === "mcp-tool";
    if (!kindMatches) {
      diagnostics.push(
        `${path}: capability "${capability.reference}" has kind "${entry.kind}", expected ${capability.expectedKind}.`,
      );
    }
    if (!entry.supportedRuntimes.includes(executor.agent)) {
      diagnostics.push(
        `${path}: capability "${capability.reference}" does not support runtime "${executor.agent}".`,
      );
    }
  }

  const usesIrreversibleCapability = capabilities.some((capability) =>
    context.capabilityCatalog.some(
      (entry) => entry.reference === capability.reference && entry.riskTier === "irreversible",
    ),
  );

  if (
    usesIrreversibleCapability &&
    !IRREVERSIBLE_EXPLANATION_PATTERN.test(executor.assignmentReason.toLowerCase())
  ) {
    diagnostics.push(
      `${prefix}.assignmentReason: an irreversible capability must be explicitly justified.`,
    );
  }

  return diagnostics;
};

const validateAssignment = (
  assignment: PerStepCapabilityAssignment,
  context: CapabilityAssignmentContext,
): string[] => {
  if (!context.steps.some((step) => step.operationId === assignment.operationId)) {
    return [`assignments.${assignment.operationId}: operation is not new or unmatched.`];
  }

  return validateAssignedOperationExecutor({
    executor: assignment.executor,
    context,
    pathPrefix: `assignments.${assignment.operationId}.executor`,
  });
};

export const parseCapabilityAssignments = (
  value: unknown,
  context: CapabilityAssignmentContext,
): CapabilityAssignmentParseResult => {
  if (context.steps.length === 0) {
    return fail(["No new or unmatched operations were supplied for assignment."]);
  }

  const output = CapabilityAssignmentOutputSchema.safeParse(value);
  if (!output.success) return fail(formatZodIssues(output.error));

  const expectedIds = new Set(context.steps.map((step) => step.operationId));
  const seenIds = new Set<string>();
  const diagnostics: string[] = [];
  for (const assignment of output.data.assignments) {
    if (seenIds.has(assignment.operationId)) {
      diagnostics.push(`assignments.${assignment.operationId}: duplicate operation assignment.`);
    }
    seenIds.add(assignment.operationId);
    diagnostics.push(...validateAssignment(assignment, context));
  }

  for (const operationId of expectedIds) {
    if (!seenIds.has(operationId)) {
      diagnostics.push(`assignments.${operationId}: missing assignment for new operation.`);
    }
  }

  return diagnostics.length > 0
    ? fail(diagnostics)
    : { ok: true, assignments: output.data.assignments, diagnostics: [] };
};
