import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { worksDao } from "@/models/daos/worksDao";
import { WorkObjectSchema } from "@/schemas";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const CreateWorkSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string(),
  object: WorkObjectSchema,
});

export const Route = createFileRoute("/api/works")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("projectId");

        const works = projectId
          ? await worksDao.findByProject(projectId)
          : await worksDao.findMany();
        return json(works);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateWorkSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const work = await worksDao.create({
          ...parsed.data,
          status: "pending",
          logs: [],
        });
        return json(work, 201);
      },
    },
  },
});
