import { z } from "zod/v4";
import { ConnectorConfigSchema } from "./ConnectorConfigSchema";
import { ConnectorMethodSchema } from "./ConnectorMethodSchema";
import { ConnectorStatusSchema } from "./ConnectorStatusSchema";

export const ConnectorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  method: ConnectorMethodSchema,
  status: ConnectorStatusSchema.default("needs_setup"),
  scopes: z.string().nullable(),
  config: ConnectorConfigSchema.default({}),
  lastSyncAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const CreateConnectorSchema = ConnectorSchema.omit({
  id: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  scopes: z.string().nullable().optional(),
});
export type CreateConnectorInput = z.infer<typeof CreateConnectorSchema>;

export const UpdateConnectorSchema = CreateConnectorSchema.partial();
export type UpdateConnectorInput = z.infer<typeof UpdateConnectorSchema>;
