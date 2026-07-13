import { z } from "zod/v4";

export const DataContractMappingSchema = z.object({
  fromField: z.string(),
  toInput: z.string(),
  type: z.string().optional(),
  enabled: z.boolean().default(true),
});
export type DataContractMapping = z.infer<typeof DataContractMappingSchema>;

export const DataContractSchema = z.object({
  mappings: z.array(DataContractMappingSchema).default([]),
});
export type DataContract = z.infer<typeof DataContractSchema>;
