import { z } from "zod/v4";
import { RuntimeModelSchema } from "./RuntimeModelSchema";

export const LocalConnectionSchema = z.object({
  mode: z.literal("local"),
  binaryName: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  detectedAt: z.iso.datetime().optional(),
  models: z.array(RuntimeModelSchema).optional(),
});
export type LocalConnection = z.infer<typeof LocalConnectionSchema>;
