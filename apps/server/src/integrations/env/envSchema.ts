import { z } from "zod/v4";

export const envSchema = z.object({
  PORT: z.coerce.number().optional(),
  JOB_TIMEOUT_MS: z.coerce.number().optional(),
  ORDINE_AGENT_API_TOKEN: z.string().min(32).optional(),
  DESKTOP_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DESKTOP_AUTH_TOKEN: z.string().min(32).optional(),
  ORDINE_DATA_DIR: z.string().min(1).optional(),
  ORDINE_MCP_SIDECAR_PATH: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;
