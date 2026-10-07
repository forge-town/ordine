import { RunRequestReceiptSchema, type AgentResourceRef } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";

import type { DomainError, DomainValue } from "../../contracts";

export const preparedSubmissionValue = (
  target: AgentResourceRef,
  value: Record<string, unknown>,
): Result<DomainValue, DomainError> => {
  const parsed = RunRequestReceiptSchema.safeParse(value);
  if (!parsed.success)
    return err({
      code: "EXECUTION_RECEIPT_INVALID",
      message: "The execution service did not return a valid request receipt.",
      retryable: false,
    });
  const receipt = parsed.data;

  return ok({
    resources: [
      target,
      ...(receipt.state === "accepted" ? [{ type: "job" as const, id: receipt.jobId }] : []),
    ],
    summary:
      receipt.state === "accepted"
        ? `Execution request accepted as Job ${receipt.jobId}; execution is not yet complete.`
        : receipt.state === "awaiting_approval"
          ? "Execution request prepared. The user must review and approve it in ORDINE before a Job is created. Do not resubmit it."
          : `Execution request is ${receipt.state}.`,
    data: { executionReceipt: receipt },
  });
};
