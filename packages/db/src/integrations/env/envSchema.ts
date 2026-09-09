import { z } from "zod/v4";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ORDINE_AUTHORING_SCHEMA: z
    .string()
    .regex(/^ordine_authoring_[a-f0-9]{16}$/u)
    .optional(),
});
