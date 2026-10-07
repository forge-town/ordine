import { err, ok, type Result } from "neverthrow";
import type { CanvasMutationInput } from "../../contracts";
import type { CanvasControlError } from "../canvasControl";
import { canvasError } from "../canvasControlCanvasError";

export const validateInvocationBinding = ({
  input,
  threadId,
  runId,
  actionId,
}: {
  input: CanvasMutationInput;
  threadId: string;
  runId: string | null;
  actionId: string;
}): Result<void, CanvasControlError> => {
  if (input.threadId !== threadId) {
    return err(
      canvasError(
        actionId,
        "THREAD_BINDING_MISMATCH",
        "The tool input threadId does not match the authenticated Agent thread.",
        false,
        { field: "threadId" },
      ),
    );
  }
  if (input.runId !== undefined && input.runId !== runId) {
    return err(
      canvasError(
        actionId,
        "RUN_BINDING_MISMATCH",
        "The tool input runId does not match the authenticated Agent run.",
        false,
        { field: "runId" },
      ),
    );
  }

  return ok(undefined);
};
