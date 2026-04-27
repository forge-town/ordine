import { z } from "zod/v4";

export const MetaSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Meta = z.infer<typeof MetaSchema>;

export function withMeta<T extends { createdAt: Date; updatedAt: Date }>(
  record: T,
): Omit<T, "createdAt" | "updatedAt"> & { meta: Meta };
export function withMeta<T extends { createdAt: Date; updatedAt: Date }>(
  record: T | undefined,
): (Omit<T, "createdAt" | "updatedAt"> & { meta: Meta }) | undefined;
export function withMeta<T extends { createdAt: Date; updatedAt: Date }>(
  record: T | undefined,
): (Omit<T, "createdAt" | "updatedAt"> & { meta: Meta }) | undefined {
  if (!record) return undefined;
  const { createdAt, updatedAt, ...rest } = record;

  return { ...rest, meta: { createdAt, updatedAt } };
}
