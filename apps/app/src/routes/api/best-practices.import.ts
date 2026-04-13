import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { BestPracticeSchema, ChecklistItemSchema } from "@/schemas";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import { checklistItemsDao } from "@/models/daos/checklistItemsDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const ImportItemSchema = BestPracticeSchema.extend({
  checklistItems: z.array(ChecklistItemSchema.omit({ bestPracticeId: true })).default([]),
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

        let bpCount = 0;
        let clCount = 0;

        for (const entry of parsed.data) {
          const { checklistItems, ...bpData } = entry;

          const existing = await bestPracticesDao.findById(bpData.id);
          if (existing) {
            const { id: _, ...patch } = bpData;
            await bestPracticesDao.update(bpData.id, patch);
          } else {
            await bestPracticesDao.create(bpData);
          }
          bpCount++;

          for (const item of checklistItems) {
            const itemData = { ...item, bestPracticeId: bpData.id };
            const existingItem = await checklistItemsDao.findById(item.id);
            if (existingItem) {
              const { id: _, bestPracticeId: __, ...patch } = itemData;
              await checklistItemsDao.update(item.id, patch);
            } else {
              await checklistItemsDao.create(itemData);
            }
            clCount++;
          }
        }

        return json({ imported: bpCount, checklistItems: clCount });
      },
    },
  },
});
