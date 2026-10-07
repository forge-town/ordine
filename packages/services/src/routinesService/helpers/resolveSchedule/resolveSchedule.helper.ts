import { err, ok, type Result } from "neverthrow";
import { resolveNextRunAt } from "../resolveNextRunAt";

// Shared invariant for create and update: an enabled routine must have a
// computable next occurrence; a disabled routine never has one.
export const resolveSchedule = (
  enabled: boolean,
  cronExpression: string | null,
): Result<Date | null, Error> => {
  const nextRunAt = resolveNextRunAt(enabled, cronExpression);
  if (enabled && !nextRunAt) {
    return err(new Error("An enabled routine requires a valid cronExpression"));
  }

  return ok(nextRunAt);
};
