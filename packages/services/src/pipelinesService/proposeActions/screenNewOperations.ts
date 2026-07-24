import type { PipelineActionDiagnostic, ProposePendingOperation } from "@repo/schemas";
import type { ParsedNewOperation } from "./parseAgentOutput";

export const NEW_OPERATION_ID_PREFIX = "op_new_";

export type ScreenNewOperationsResult = {
  accepted: ParsedNewOperation[];
  diagnostics: PipelineActionDiagnostic[];
  rejectedIds: string[];
};

/**
 * Enforce the agent-drafted operation contract: ids must start with
 * `op_new_` and must not collide with the operation catalog (which includes
 * previously materialized op_new_ ids). Non-conforming entries are dropped —
 * they never enter the catalog map or pendingOperations — so the agent
 * cannot shadow a real operation; each drop surfaces as a warning
 * diagnostic.
 */
export const screenNewOperations = (
  newOperations: ParsedNewOperation[],
  catalogById: Map<string, { name: string }>,
): ScreenNewOperationsResult => {
  const accepted: ParsedNewOperation[] = [];
  const acceptedIds = new Set<string>();
  const diagnostics: PipelineActionDiagnostic[] = [];
  const rejectedIds: string[] = [];

  for (const operation of newOperations) {
    if (!operation.id.startsWith(NEW_OPERATION_ID_PREFIX)) {
      diagnostics.push({
        actionIndex: null,
        code: "INVALID_NODE_DATA",
        message: `Dropped drafted operation "${operation.name}": id "${operation.id}" must start with "${NEW_OPERATION_ID_PREFIX}".`,
        severity: "warning",
      });
      rejectedIds.push(operation.id);
      continue;
    }

    if (catalogById.has(operation.id) || acceptedIds.has(operation.id)) {
      diagnostics.push({
        actionIndex: null,
        code: "INVALID_NODE_DATA",
        message: `Dropped drafted operation "${operation.name}": id "${operation.id}" collides with an existing operation.`,
        severity: "warning",
      });
      rejectedIds.push(operation.id);
      continue;
    }

    accepted.push(operation);
    acceptedIds.add(operation.id);
  }

  return { accepted, diagnostics, rejectedIds };
};

/** Materialize agent-drafted operations as pending operation configs. */
export const toPendingOperations = (
  newOperations: ParsedNewOperation[],
): ProposePendingOperation[] =>
  newOperations.map((operation) => ({
    acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
    config: {
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt:
          operation.prompt.trim().length > 0
            ? operation.prompt
            : [
                `You are an automation agent executing the task: "${operation.name}".`,
                operation.description ? `Context: ${operation.description}` : "",
                "",
                "You will receive input data from the previous pipeline step.",
                "Analyze the input thoroughly and execute the task described above.",
                "Output your results in well-structured markdown format.",
              ]
                .filter(Boolean)
                .join("\n"),
      },
      inputs: [],
      outputs: [
        {
          name: "result",
          contentType: "markdown",
          description: "Generated result",
          templateIds: [],
        },
      ],
    },
    description: operation.description,
    id: operation.id,
    name: operation.name,
  }));
