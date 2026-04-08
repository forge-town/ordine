import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { worksDao } from "@/models/daos/worksDao";
import { WorkObjectSchema } from "@/schemas";

const CreateWorkSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  pipelineId: z.string(),
  pipelineName: z.string(),
  object: WorkObjectSchema,
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

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
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreateWorkSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
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
