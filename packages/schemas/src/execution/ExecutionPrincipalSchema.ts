import { z } from "zod/v4";
import { ExecutionIdentifierSchema } from "./ExecutionProtocolSchema";

export const ExecutionScopeSchema = z.enum([
  "definitions:read",
  "definitions:write",
  "execution:submit",
  "execution:approve",
  "execution:read",
  "execution:control",
  "artifacts:read",
  "artifacts:import",
]);
export type ExecutionScope = z.infer<typeof ExecutionScopeSchema>;

/** Constructed by authentication middleware, never accepted from execution request bodies. */
export const ExecutionPrincipalSchema = z.strictObject({
  subjectId: ExecutionIdentifierSchema,
  workspaceId: ExecutionIdentifierSchema,
  scopes: z.array(ExecutionScopeSchema).max(8),
});
export type ExecutionPrincipal = z.infer<typeof ExecutionPrincipalSchema>;
