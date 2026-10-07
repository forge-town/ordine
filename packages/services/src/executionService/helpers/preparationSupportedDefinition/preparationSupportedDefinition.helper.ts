import { validateOperationDefinition } from "@repo/pipeline-engine";
import type { OperationRevision } from "@repo/schemas";

import { executionFailure } from "../serviceResult";

import { unwrap } from "../../helpers/preparationUnwrap";

export const supportedDefinition = (operation: OperationRevision) => {
  unwrap(validateOperationDefinition(operation));
  if (operation.capabilityRefs.length > 0)
    executionFailure(
      "CAPABILITY_UNSUPPORTED",
      "This execution adapter does not implement capability references",
      "capabilityRefs",
    );
  const executor = operation.executor;
  if (executor.kind === "agent") {
    if (executor.skillId || executor.allowedTools.length > 0)
      executionFailure(
        "AGENT_TOOLS_UNSUPPORTED",
        "Prompt operations currently require an explicit instruction without external tools or skills",
        "executor",
      );
    if (
      operation.outputPorts.length !== 1 ||
      operation.outputPorts[0]?.cardinality !== "one" ||
      !["text", "json"].includes(operation.outputPorts[0]?.valueType ?? "")
    )
      executionFailure(
        "AGENT_OUTPUT_UNSUPPORTED",
        "Prompt operations require exactly one text or JSON output port",
        "outputPorts",
      );
  }
  if (
    executor.kind === "script" &&
    executor.outputMode !== "manifest" &&
    (operation.outputPorts.length !== 1 ||
      operation.outputPorts[0]?.cardinality !== "one" ||
      operation.outputPorts[0]?.valueType !== executor.outputMode)
  )
    executionFailure(
      "SCRIPT_OUTPUT_INVALID",
      "Text and JSON scripts require exactly one matching output port",
      "outputPorts",
    );
};
