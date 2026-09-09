import { z } from "zod/v4";
import {
  ExecutionIdentifierSchema,
  ExecutionRequestIdSchema,
  ExecutionTimestampSchema,
} from "./ExecutionProtocolSchema";
import { PreparedRunSchema } from "./PreparedRunSchema";

export const ExecutionApprovalSchema = z.strictObject({
  id: ExecutionIdentifierSchema,
  requestId: ExecutionRequestIdSchema,
  expiresAt: ExecutionTimestampSchema,
  state: z.enum(["pending", "approved", "rejected", "expired"]),
  prepared: PreparedRunSchema,
});
export type ExecutionApproval = z.infer<typeof ExecutionApprovalSchema>;
