import { z } from "zod/v4";

export const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().optional(),
}).refine(
  (env) => env.DATABASE_URL || env.PGLITE_DATA_DIR,
  { message: "Either DATABASE_URL or PGLITE_DATA_DIR must be set" },
);

export type Env = z.infer<typeof envSchema>;
