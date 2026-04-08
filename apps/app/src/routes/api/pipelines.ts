import { createFileRoute } from "@tanstack/react-router";
import { PipelineSchema } from "@/schemas";
import { pipelinesDao } from "@/models/daos/pipelinesDao";

const CreatePipelineSchema = PipelineSchema.omit({
  createdAt: true,
  updatedAt: true,
  nodeCount: true,
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/pipelines")({
  server: {
    handlers: {
      GET: async () => {
        const pipelines = await pipelinesDao.findMany();
        return json(pipelines);
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreatePipelineSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const pipeline = await pipelinesDao.create({
          ...parsed.data,
          nodes: parsed.data.nodes as Parameters<
            typeof pipelinesDao.create
          >[0]["nodes"],
          edges: parsed.data.edges as Parameters<
            typeof pipelinesDao.create
          >[0]["edges"],
        });
        return json(pipeline, 201);
      },
    },
  },
});
