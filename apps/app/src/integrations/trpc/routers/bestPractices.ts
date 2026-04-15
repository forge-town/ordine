import { publicProcedure, router } from "../init";
import { bestPracticesService, checklistService, codeSnippetsService } from "../services";
import { BestPracticeSchema, ChecklistItemSchema, CodeSnippetSchema } from "@repo/schemas";
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

  exportAll: publicProcedure.query(async () => {
    const practices = await bestPracticesService.getAll();
    return Promise.all(
      practices.map(async (bp) => {
        const [checklistItems, codeSnippets] = await Promise.all([
          checklistService.getItemsByBestPracticeId(bp.id),
          codeSnippetsService.getByBestPracticeId(bp.id),
        ]);
        return {
          ...bp,
          checklistItems: checklistItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            checkType: item.checkType,
            script: item.script,
            sortOrder: item.sortOrder,
          })),
          codeSnippets: codeSnippets.map((s) => ({
            id: s.id,
            title: s.title,
            language: s.language,
            code: s.code,
            sortOrder: s.sortOrder,
          })),
        };
      }),
    );
  }),

  importBulk: publicProcedure
    .input(
      z.array(
        BestPracticeSchema.extend({
          checklistItems: z.array(ChecklistItemSchema.omit({ bestPracticeId: true })).default([]),
          codeSnippets: z.array(CodeSnippetSchema.omit({ bestPracticeId: true })).default([]),
        }),
      ),
    )
    .mutation(async ({ input }) => {
      const counts = { imported: 0, checklistItems: 0, codeSnippets: 0 };

      for (const entry of input) {
        const { checklistItems, codeSnippets, ...bpData } = entry;

        const existing = await bestPracticesService.getById(bpData.id);
        if (existing) {
          const { id: _, ...patch } = bpData;
          await bestPracticesService.update(bpData.id, patch);
        } else {
          await bestPracticesService.create(bpData);
        }
        counts.imported++;

        for (const item of checklistItems) {
          const itemData = { ...item, bestPracticeId: bpData.id };
          const existingItem = await checklistService.getItemById(item.id);
          if (existingItem) {
            const { id: _id, bestPracticeId: _bpId, ...patch } = itemData;
            await checklistService.updateItem(item.id, patch);
          } else {
            await checklistService.createItem(itemData);
          }
          counts.checklistItems++;
        }

        for (const snippet of codeSnippets) {
          const snippetData = { ...snippet, bestPracticeId: bpData.id };
          const existingSnippet = await codeSnippetsService.getById(snippet.id);
          if (existingSnippet) {
            const { id: _id, bestPracticeId: _bpId, ...patch } = snippetData;
            await codeSnippetsService.update(snippet.id, patch);
          } else {
            await codeSnippetsService.create(snippetData);
          }
          counts.codeSnippets++;
        }
      }

      return counts;
    }),
});
