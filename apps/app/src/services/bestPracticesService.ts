import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { bestPracticesDao } from "@repo/models";
import { BestPracticeSchema } from "@repo/schemas";
import { createBestPracticesService } from "@repo/services";

const service = createBestPracticesService(bestPracticesDao);

export const getBestPractices = createServerFn({ method: "GET" }).handler(() => service.getAll());

export const getBestPracticeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createBestPractice = createServerFn({ method: "POST" })
  .inputValidator(BestPracticeSchema)
  .handler(({ data }) => service.create(data));

export const updateBestPractice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: BestPracticeSchema.partial() }))
  .handler(({ data }) => service.update(data.id, data.patch));

export const deleteBestPractice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
