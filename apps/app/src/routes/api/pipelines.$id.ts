import { createFileRoute } from "@tanstack/react-router";
import { PipelineSchema } from "@/schemas";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const UpdatePipelineSchema = PipelineSchema.partial().omit({ id: true });

export const Route = createFileRoute("/api/pipelines/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const pipeline = await pipelinesDao.findById(params.id);
        if (!pipeline) return errorResponse("Pipeline not found", 404);
        return json(pipeline);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdatePipelineSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const pipeline = await pipelinesDao.update(params.id, {
          ...parsed.data,
          nodes: parsed.data.nodes as Parameters<typeof pipelinesDao.update>[1]["nodes"],
          edges: parsed.data.edges as Parameters<typeof pipelinesDao.update>[1]["edges"],
        });
        return json(pipeline);
      },

      DELETE: async ({ params }) => {
        const existing = await pipelinesDao.findById(params.id);
        if (!existing) return errorResponse("Pipeline not found", 404);
        await pipelinesDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
