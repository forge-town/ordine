import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { checklistItemsDao, checklistResultsDao } from "@repo/models";
import { ChecklistItemSchema, ChecklistResultSchema } from "@/schemas";

export const getChecklistItemsByBestPracticeId = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ bestPracticeId: z.string() }))
  .handler(({ data }) => checklistItemsDao.findByBestPracticeId(data.bestPracticeId));

export const getChecklistItemById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => checklistItemsDao.findById(data.id));

export const createChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(ChecklistItemSchema)
  .handler(({ data }) => checklistItemsDao.create(data));

export const updateChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: ChecklistItemSchema.partial() }))
  .handler(({ data }) => checklistItemsDao.update(data.id, data.patch));

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => checklistItemsDao.delete(data.id));

export const getChecklistResultsByJobId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ jobId: z.string() }))
  .handler(({ data }) => checklistResultsDao.findByJobId(data.jobId));

export const createChecklistResult = createServerFn({ method: "POST" })
  .inputValidator(ChecklistResultSchema)
  .handler(({ data }) => checklistResultsDao.create(data));
