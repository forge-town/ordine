import { publicProcedure, router } from "../init";
import { checklistItemsDao, checklistResultsDao } from "@repo/models";
import { ChecklistItemSchema, ChecklistResultSchema } from "@repo/schemas";
import { z } from "zod/v4";

export const checklistRouter = router({
  getItemsByBestPracticeId: publicProcedure
    .input(z.object({ bestPracticeId: z.string() }))
    .query(({ input }) => checklistItemsDao.findByBestPracticeId(input.bestPracticeId)),

  getItemById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => checklistItemsDao.findById(input.id)),

  createItem: publicProcedure
    .input(ChecklistItemSchema)
    .mutation(({ input }) => checklistItemsDao.create(input)),

  updateItem: publicProcedure
    .input(z.object({ id: z.string(), patch: ChecklistItemSchema.partial() }))
    .mutation(({ input }) => checklistItemsDao.update(input.id, input.patch)),

  deleteItem: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => checklistItemsDao.delete(input.id)),

  getResultsByJobId: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => checklistResultsDao.findByJobId(input.jobId)),

  createResult: publicProcedure
    .input(ChecklistResultSchema)
    .mutation(({ input }) => checklistResultsDao.create(input)),
});
