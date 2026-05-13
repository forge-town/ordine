import {
  DistillationConfigSchema,
  DistillationResultSchema,
  type DistillationConfig,
  type DistillationResult,
} from "@repo/schemas";

const normalizeDistillationConfig = (config: unknown) => {
  const parsed = DistillationConfigSchema.safeParse(config);

  return parsed.success ? parsed.data : DistillationConfigSchema.parse({ objective: "" });
};

const normalizeDistillationResult = (result: unknown) => {
  const parsed = DistillationResultSchema.safeParse(result);

  return parsed.success ? parsed.data : null;
};

export const normalizeDistillationRecord = <
  T extends {
    config: unknown;
    result: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  record: T,
): Omit<T, "config" | "result"> & {
  config: DistillationConfig;
  result: DistillationResult | null;
} => ({
  ...record,
  config: normalizeDistillationConfig(record.config),
  result: normalizeDistillationResult(record.result),
});
