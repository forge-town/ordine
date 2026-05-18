import { z } from "zod/v4";
import { LocalConnectionSchema } from "./LocalConnectionSchema";
import { SshConnectionSchema } from "./SshConnectionSchema";

export const AgentRuntimeConnectionSchema = z.discriminatedUnion("mode", [
  LocalConnectionSchema,
  SshConnectionSchema,
]);
export type AgentRuntimeConnection = z.infer<typeof AgentRuntimeConnectionSchema>;
