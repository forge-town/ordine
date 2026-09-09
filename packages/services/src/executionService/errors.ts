import { z } from "zod/v4";

export const NodeExecutionResolutionErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "RUNTIME_REQUIRED",
  "RUNTIME_NOT_FOUND",
  "INVALID_RUNTIME_CONFIG",
  "RUNTIME_UNSUPPORTED",
  "EXECUTABLE_PATH_REQUIRED",
  "CAPABILITIES_UNKNOWN",
  "INVALID_CAPABILITIES",
  "MODEL_REQUIRED",
  "MODEL_UNSUPPORTED",
  "OPTION_UNSUPPORTED",
  "INVALID_RESOLVED_EXECUTION",
]);
export type NodeExecutionResolutionErrorCode = z.infer<
  typeof NodeExecutionResolutionErrorCodeSchema
>;

export class NodeExecutionResolutionError extends Error {
  constructor(
    public readonly code: NodeExecutionResolutionErrorCode,
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "NodeExecutionResolutionError";
  }
}
