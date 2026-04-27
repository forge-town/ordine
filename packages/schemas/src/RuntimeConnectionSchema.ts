import { z } from "zod/v4";
import { LocalConnectionSchema } from "./LocalConnectionSchema";
import { SshConnectionSchema } from "./SshConnectionSchema";

export const RuntimeConnectionSchema = z.discriminatedUnion("mode", [
  LocalConnectionSchema,
  SshConnectionSchema,
]);

export type RuntimeConnection = z.infer<typeof RuntimeConnectionSchema>;
