import { z } from "zod/v4";

export const LocalConnectionSchema = z.object({
  mode: z.literal("local"),
  binaryName: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  detectedAt: z.iso.datetime().optional(),
});
export type LocalConnection = z.infer<typeof LocalConnectionSchema>;
