import { z } from "zod/v4";

export const AgentRawExportStatusSchema = z.enum(["completed", "error"]);
export type AgentRawExportStatus = z.infer<typeof AgentRawExportStatusSchema>;
