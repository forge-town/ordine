import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { worksDao } from "@repo/models";
import { WorkObjectSchema } from "@repo/schemas";
import { createWorksService } from "@repo/services";

const service = createWorksService(worksDao);

export const getWorks = createServerFn({ method: "GET" }).handler(() => service.getAll());

export const getWorksByProject = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(({ data }) => service.getByProject(data.projectId));

export const getWorkById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createWork = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      projectId: z.string(),
      pipelineId: z.string(),
      pipelineName: z.string(),
      object: WorkObjectSchema,
    })
  )
  .handler(({ data }) => service.create({ ...data, status: "pending", logs: [] }));

export const updateWorkStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      status: z.enum(["pending", "running", "success", "failed"]),
    })
  )
  .handler(({ data }) => service.updateStatus(data.id, data.status));

export const deleteWork = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
