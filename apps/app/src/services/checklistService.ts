import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { checklistItemsDao, checklistResultsDao } from "@repo/models";
import { ChecklistItemSchema, ChecklistResultSchema } from "@repo/schemas";
import { createChecklistService } from "@repo/services";

const service = createChecklistService(checklistItemsDao, checklistResultsDao);

export const getChecklistItemsByBestPracticeId = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ bestPracticeId: z.string() }))
  .handler(({ data }) => service.getItemsByBestPracticeId(data.bestPracticeId));

export const getChecklistItemById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getItemById(data.id));

export const createChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(ChecklistItemSchema)
  .handler(({ data }) => service.createItem(data));

export const updateChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: ChecklistItemSchema.partial() }))
  .handler(({ data }) => service.updateItem(data.id, data.patch));

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.deleteItem(data.id));

export const getChecklistResultsByJobId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ jobId: z.string() }))
  .handler(({ data }) => service.getResultsByJobId(data.jobId));

export const createChecklistResult = createServerFn({ method: "POST" })
  .inputValidator(ChecklistResultSchema)
  .handler(({ data }) => service.createResult(data));
