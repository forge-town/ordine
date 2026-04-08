import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import { BestPracticeSchema } from "@/schemas";

export const getBestPractices = createServerFn({ method: "GET" }).handler(() =>
  bestPracticesDao.findMany()
);

export const getBestPracticeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => bestPracticesDao.findById(data.id));

export const createBestPractice = createServerFn({ method: "POST" })
  .inputValidator(BestPracticeSchema)
  .handler(({ data }) => bestPracticesDao.create(data));

export const updateBestPractice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: BestPracticeSchema.partial() }))
  .handler(({ data }) => bestPracticesDao.update(data.id, data.patch));

export const deleteBestPractice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => bestPracticesDao.delete(data.id));
