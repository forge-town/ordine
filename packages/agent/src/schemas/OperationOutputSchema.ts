import { z } from "zod/v4";
import { CheckOutputSchema } from "./CheckOutputSchema";
import { FixOutputSchema } from "./FixOutputSchema";

export const OperationOutputSchema = z.discriminatedUnion("type", [
  CheckOutputSchema,
  FixOutputSchema,
]);
export type OperationOutput = z.infer<typeof OperationOutputSchema>;
