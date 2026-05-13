import { z } from "zod/v4";

export const AgentTextSchema = z.string().refine(
  // oxlint-disable-next-line no-control-regex
  (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value),
  {
    message: "Text must not contain control characters",
  },
);
export type AgentText = z.infer<typeof AgentTextSchema>;
