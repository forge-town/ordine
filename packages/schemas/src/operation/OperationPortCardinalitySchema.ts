import { z } from "zod/v4";

export const OperationPortCardinalitySchema = z.enum(["one", "many"]);
export type OperationPortCardinality = z.infer<typeof OperationPortCardinalitySchema>;
