import { z } from "zod/v4";
import { BestPracticeImportEntrySchema } from "./BestPracticeImportEntrySchema";

export const BestPracticeImportSchema = z.array(BestPracticeImportEntrySchema);
export type BestPracticeImport = z.infer<typeof BestPracticeImportSchema>;
