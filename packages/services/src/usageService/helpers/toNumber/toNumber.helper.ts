import { logger } from "@repo/logger";

// Product decision: cost was cut across the whole product — usage is reported
// in tokens only (no totalCost/avgCostPerRun/daily cost series).
// Non-finite inputs (NaN/Infinity, e.g. malformed driver values) are coerced
// to 0 with a warning so they never reach the UI.
export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    logger.warn({ value }, "usageService: non-finite usage value coerced to 0");

    return 0;
  }

  return parsed;
};
