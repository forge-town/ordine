import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { BestPracticeSchema, ChecklistItemSchema, CodeSnippetSchema } from "@/schemas";
import { bestPracticesDao, checklistItemsDao, codeSnippetsDao } from "@repo/models";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const ImportItemSchema = BestPracticeSchema.extend({
  checklistItems: z.array(ChecklistItemSchema.omit({ bestPracticeId: true })).default([]),
  codeSnippets: z.array(CodeSnippetSchema.omit({ bestPracticeId: true })).default([]),
});

const ImportSchema = z.array(ImportItemSchema);

export const Route = createFileRoute("/api/best-practices/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = ImportSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const counts = { bp: 0, cl: 0, cs: 0 };

        for (const entry of parsed.data) {
          const { checklistItems, codeSnippets, ...bpData } = entry;

          const existing = await bestPracticesDao.findById(bpData.id);
          if (existing) {
            const { id: _, ...patch } = bpData;
            await bestPracticesDao.update(bpData.id, patch);
          } else {
            await bestPracticesDao.create(bpData);
          }
          counts.bp++;

          for (const item of checklistItems) {
            const itemData = { ...item, bestPracticeId: bpData.id };
            const existingItem = await checklistItemsDao.findById(item.id);
            if (existingItem) {
              const { id: _, bestPracticeId: __, ...patch } = itemData;
              await checklistItemsDao.update(item.id, patch);
            } else {
              await checklistItemsDao.create(itemData);
            }
            counts.cl++;
          }

          for (const snippet of codeSnippets) {
            const snippetData = { ...snippet, bestPracticeId: bpData.id };
            const existingSnippet = await codeSnippetsDao.findById(snippet.id);
            if (existingSnippet) {
              const { id: _, bestPracticeId: __, ...patch } = snippetData;
              await codeSnippetsDao.update(snippet.id, patch);
            } else {
              await codeSnippetsDao.create(snippetData);
            }
            counts.cs++;
          }
        }

        return json({ imported: counts.bp, checklistItems: counts.cl, codeSnippets: counts.cs });
      },
    },
  },
});
