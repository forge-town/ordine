import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { pipelinesDao } from "@repo/models";
import { PipelineSchema } from "@repo/schemas";
import { createPipelinesService } from "@repo/services";

const service = createPipelinesService(pipelinesDao);

export const getPipelines = createServerFn({ method: "GET" }).handler(() => service.getAll());

export const getPipelineById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createPipeline = createServerFn({ method: "POST" })
  .inputValidator(PipelineSchema)
  .handler(({ data }) =>
    service.create({
      ...data,
      nodes: data.nodes as Parameters<typeof pipelinesDao.create>[0]["nodes"],
      edges: data.edges as Parameters<typeof pipelinesDao.create>[0]["edges"],
    })
  );

export const updatePipeline = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      patch: PipelineSchema.partial(),
    })
  )
  .handler(({ data }) =>
    service.update(data.id, {
      ...data.patch,
      nodes: data.patch.nodes as Parameters<typeof pipelinesDao.update>[1]["nodes"] | undefined,
      edges: data.patch.edges as Parameters<typeof pipelinesDao.update>[1]["edges"] | undefined,
    })
  );

export const deletePipeline = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
