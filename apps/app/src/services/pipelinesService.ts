import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { pipelinesDao } from "@repo/models";
import { PipelineSchema } from "@/schemas";

export const getPipelines = createServerFn({ method: "GET" }).handler(async () => {
  return pipelinesDao.findMany();
});

export const getPipelineById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    return pipelinesDao.findById(data.id);
  });

export const createPipeline = createServerFn({ method: "POST" })
  .inputValidator(PipelineSchema)
  .handler(async ({ data }) => {
    return pipelinesDao.create({
      ...data,
      nodes: data.nodes as Parameters<typeof pipelinesDao.create>[0]["nodes"],
      edges: data.edges as Parameters<typeof pipelinesDao.create>[0]["edges"],
    });
  });

export const updatePipeline = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      patch: PipelineSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    await pipelinesDao.update(data.id, {
      ...data.patch,
      nodes: data.patch.nodes as Parameters<typeof pipelinesDao.update>[1]["nodes"] | undefined,
      edges: data.patch.edges as Parameters<typeof pipelinesDao.update>[1]["edges"] | undefined,
    });
  });

export const deletePipeline = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await pipelinesDao.delete(data.id);
  });
