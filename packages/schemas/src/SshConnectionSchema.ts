import { z } from "zod/v4";

export const SshConnectionSchema = z.object({
  mode: z.literal("ssh"),
  host: z.string().min(1),
  user: z.string().min(1),
  port: z.number().int().positive().optional(),
  keyPath: z.string().optional(),
});

export type SshConnection = z.infer<typeof SshConnectionSchema>;
