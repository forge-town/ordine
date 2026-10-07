import {
  type createCapabilityCatalogService,
  type CapabilityCatalogServiceOptions,
} from "../capabilityCatalogService";
import { ConflictError } from "../serviceErrors";
export class OperationInUseConflictError extends ConflictError {
  readonly code = "OPERATION_IN_USE";

  constructor(
    readonly operationId: string,
    readonly pipelineIds: string[],
  ) {
    super(`Operation ${operationId} is referenced by Pipeline ${pipelineIds.join(", ")}`);
    this.name = "OperationInUseConflictError";
  }
}
export interface OperationsServiceOptions {
  capabilityCatalog?: ReturnType<typeof createCapabilityCatalogService>;
  capabilityCatalogOptions?: CapabilityCatalogServiceOptions;
}
