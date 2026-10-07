import type {
  createCapabilityRiskOverridesDao,
  createConnectorsDao,
  createSkillsDao,
} from "@repo/models";
import { type CapabilityCatalogValidationIssue } from "@repo/schemas";

import { ServiceError } from "../serviceErrors";

import { capabilityValidationMessage } from "./helpers/capabilityValidationMessage";
import { operationConfigValidationMessage } from "./helpers/operationConfigValidationMessage";
type ConnectorsDao = ReturnType<typeof createConnectorsDao>;
type SkillsDao = ReturnType<typeof createSkillsDao>;
type RiskOverridesDao = ReturnType<typeof createCapabilityRiskOverridesDao>;
export interface CapabilityCatalogServiceDependencies {
  connectorsDao: Pick<ConnectorsDao, "findMany">;
  skillsDao: Pick<SkillsDao, "findMany" | "seedIfEmpty">;
  riskOverridesDao: Pick<RiskOverridesDao, "delete" | "findMany" | "upsert">;
}
export interface CapabilityCatalogServiceOptions {
  dependencies?: CapabilityCatalogServiceDependencies;
}
export interface OperationCapabilityValidationInput {
  config?: unknown;
  sourceSkillId?: unknown;
}
export interface OperationConfigShapeValidationIssue {
  path: string;
  message: string;
}
export class CapabilityCatalogValidationError extends ServiceError {
  constructor(readonly issues: CapabilityCatalogValidationIssue[]) {
    super(capabilityValidationMessage(issues));
    this.name = "CapabilityCatalogValidationError";
  }
}
export class OperationConfigValidationError extends ServiceError {
  constructor(readonly issues: OperationConfigShapeValidationIssue[]) {
    super(operationConfigValidationMessage(issues));
    this.name = "OperationConfigValidationError";
  }
}
