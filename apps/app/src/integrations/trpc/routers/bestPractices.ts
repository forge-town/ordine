import { publicProcedure, router } from "../init";
import { bestPracticesService, bestPracticesBulkService } from "../services";
import { BestPracticeImportSchema, BestPracticeSchema } from "@repo/schemas";
import { z } from "zod/v4";

export const bestPracticesRouter = router({
  getMany: publicProcedure.query(() => bestPracticesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => bestPracticesService.getById(input.id)),

  create: publicProcedure
    .input(BestPracticeSchema)
    .mutation(({ input }) => bestPracticesService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: BestPracticeSchema.partial() }))
    .mutation(({ input }) => bestPracticesService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => bestPracticesService.delete(input.id)),

  exportAll: publicProcedure.query(() => bestPracticesBulkService.exportAll()),

  exportAsZip: publicProcedure.query(async () => {
    const zipData = await bestPracticesBulkService.exportAsZip();

    return Buffer.from(zipData).toString("base64");
  }),

  importBulk: publicProcedure
    .input(BestPracticeImportSchema)
    .mutation(({ input }) => bestPracticesBulkService.importBulk(input)),

  previewImport: publicProcedure
    .input(BestPracticeImportSchema)
    .mutation(({ input }) => bestPracticesBulkService.previewImport(input)),
});
