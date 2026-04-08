import { createFileRoute } from "@tanstack/react-router";
import { PipelineSchema } from "@/schemas";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const CreatePipelineSchema = PipelineSchema.omit({
  createdAt: true,
  updatedAt: true,
  nodeCount: true,
});

export const Route = createFileRoute("/api/pipelines")({
  server: {
    handlers: {
      GET: async () => {
        const pipelines = await pipelinesDao.findMany();
        return json(pipelines);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreatePipelineSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const pipeline = await pipelinesDao.create({
          ...parsed.data,
          nodes: parsed.data.nodes as Parameters<typeof pipelinesDao.create>[0]["nodes"],
          edges: parsed.data.edges as Parameters<typeof pipelinesDao.create>[0]["edges"],
        });
        return json(pipeline, 201);
      },
    },
  },
});
