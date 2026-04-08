import { createFileRoute } from "@tanstack/react-router";
import { PipelineSchema } from "@/schemas";
import { pipelinesDao } from "@/models/daos/pipelinesDao";

const UpdatePipelineSchema = PipelineSchema.partial().omit({ id: true });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/pipelines/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const pipeline = await pipelinesDao.findById(params.id);
        if (!pipeline) return error("Pipeline not found", 404);
        return json(pipeline);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdatePipelineSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const pipeline = await pipelinesDao.update(params.id, {
          ...parsed.data,
          nodes: parsed.data.nodes as Parameters<
            typeof pipelinesDao.update
          >[1]["nodes"],
          edges: parsed.data.edges as Parameters<
            typeof pipelinesDao.update
          >[1]["edges"],
        });
        return json(pipeline);
      },

      DELETE: async ({ params }) => {
        const existing = await pipelinesDao.findById(params.id);
        if (!existing) return error("Pipeline not found", 404);
        await pipelinesDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
