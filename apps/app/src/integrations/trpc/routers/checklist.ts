import { publicProcedure, router } from "../init";
import { checklistService } from "../services";
import { ChecklistItemSchema, ChecklistResultSchema } from "@repo/schemas";
import { z } from "zod/v4";

export const checklistRouter = router({
  getItemsByBestPracticeId: publicProcedure
    .input(z.object({ bestPracticeId: z.string() }))
    .query(({ input }) => checklistService.getItemsByBestPracticeId(input.bestPracticeId)),

  getItemById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => checklistService.getItemById(input.id)),

  createItem: publicProcedure
    .input(ChecklistItemSchema)
    .mutation(({ input }) => checklistService.createItem(input)),

  updateItem: publicProcedure
    .input(z.object({ id: z.string(), patch: ChecklistItemSchema.partial() }))
    .mutation(({ input }) => checklistService.updateItem(input.id, input.patch)),

  deleteItem: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => checklistService.deleteItem(input.id)),

  getResultsByJobId: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => checklistService.getResultsByJobId(input.jobId)),

  createResult: publicProcedure
    .input(ChecklistResultSchema)
    .mutation(({ input }) => checklistService.createResult(input)),
});
