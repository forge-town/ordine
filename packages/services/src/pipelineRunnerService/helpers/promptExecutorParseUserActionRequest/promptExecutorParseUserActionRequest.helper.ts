import { err, ok, Result } from "neverthrow";

import { TRACE_MARKER, UserActionPayloadSchema } from "@repo/schemas";

import type { UserActionRequest, PromptExecutorAssemblyBindings } from "../../contracts";

export const createPromptExecutorParseUserActionRequestHelper =
  (_serviceBindings: Pick<PromptExecutorAssemblyBindings, never>) =>
  (rawText: string): Result<UserActionRequest | null, Error> => {
    const line = rawText
      .split(/\r?\n/)
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate.startsWith(TRACE_MARKER.userAction));
    if (!line) return ok(null);
    const payloadText = line.slice(TRACE_MARKER.userAction.length);
    const decoded = Result.fromThrowable(
      () => JSON.parse(payloadText) as unknown,
      () => new Error("Agent emitted an invalid user-action marker"),
    )();
    if (decoded.isErr()) return err(decoded.error);
    const parsed = UserActionPayloadSchema.safeParse(decoded.value);
    if (!parsed.success) return err(new Error("Agent emitted an invalid user-action marker"));

    return ok({ line, payload: parsed.data });
  };
