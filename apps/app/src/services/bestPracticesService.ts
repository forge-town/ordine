import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";

export const getBestPractices = createServerFn({ method: "GET" }).handler(() =>
  bestPracticesDao.findMany()
);

export const getBestPracticeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => bestPracticesDao.findById(data.id));

const BestPracticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  condition: z.string(),
  category: z.string().default("general"),
  language: z.string().default("typescript"),
  codeSnippet: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export const createBestPractice = createServerFn({ method: "POST" })
  .inputValidator(BestPracticeSchema)
  .handler(({ data }) => bestPracticesDao.create(data));

export const updateBestPractice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: BestPracticeSchema.partial() }))
  .handler(({ data }) => bestPracticesDao.update(data.id, data.patch));

export const deleteBestPractice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => bestPracticesDao.delete(data.id));
