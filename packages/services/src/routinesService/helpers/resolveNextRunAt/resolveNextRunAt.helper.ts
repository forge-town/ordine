import { getNextCronRunAt } from "@repo/utils";

// Disabled routines never have a pending occurrence; enabled routines get the
// next occurrence of their cron expression (null when the expression is
// missing or invalid, which the scheduler treats as "do not schedule").
export const resolveNextRunAt = (enabled: boolean, cronExpression: string | null): Date | null =>
  enabled ? getNextCronRunAt(cronExpression, new Date()) : null;
