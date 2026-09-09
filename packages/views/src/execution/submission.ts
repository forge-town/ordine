import { z } from "zod";
import {
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  type RunRequestInput,
  type RunRequestReceipt,
} from "@repo/schemas";

export const SubmissionSchema = z.object({
  phase: z.enum([
    "idle",
    "submitting",
    "uncertain",
    "awaiting_approval",
    "accepted",
    "rejected",
    "expired",
    "invalid",
  ]),
  request: RunRequestInputSchema.nullable(),
  receipt: RunRequestReceiptSchema.nullable(),
  error: z.string().nullable(),
});
export type SubmissionState = z.infer<typeof SubmissionSchema>;
export const idleSubmission = (): SubmissionState => ({
  phase: "idle",
  request: null,
  receipt: null,
  error: null,
});
export const beginSubmission = (
  state: SubmissionState,
  request: RunRequestInput,
): SubmissionState =>
  state.phase === "idle"
    ? {
        phase: "submitting",
        request: RunRequestInputSchema.parse(request),
        receipt: null,
        error: null,
      }
    : state;
export const receiveReceipt = (
  state: SubmissionState,
  receipt: RunRequestReceipt,
): SubmissionState => {
  if (!state.request || state.request.requestId !== receipt.requestId)
    return { ...state, phase: "uncertain", error: "回执与原 requestId 不一致，请查询恢复。" };

  return {
    ...state,
    receipt,
    phase: receipt.state,
    error: receipt.state === "invalid" ? receipt.error.message : null,
  };
};
export const uncertainSubmission = (state: SubmissionState, error: string): SubmissionState => ({
  ...state,
  phase: "uncertain",
  error,
});
