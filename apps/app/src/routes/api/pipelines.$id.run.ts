import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { jobsDao } from "@/models/daos/jobsDao";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { runPipeline } from "@/services/pipelineRunnerService";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const RunPipelineSchema = z.object({
  inputPath: z.string().optional(),
  githubToken: z.string().optional(),
});

export const Route = createFileRoute("/api/pipelines/$id/run")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const pipeline = await pipelinesDao.findById(params.id);
        if (!pipeline) return errorResponse("Pipeline not found", 404);

        const bodyResult = await parseJsonBody(request);
        const body = bodyResult.isOk() ? bodyResult.value : {};

        const parsed = RunPipelineSchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const jobId = randomUUID();
        await jobsDao.create({
          id: jobId,
          title: `Run: ${pipeline.name}`,
          type: "pipeline_run",
          pipelineId: params.id,
          workId: null,
          projectId: null,
          logs: [],
          result: null,
          error: null,
          status: "queued",
          startedAt: null,
          finishedAt: null,
        });

        void runPipeline({
          pipelineId: params.id,
          inputPath: parsed.data.inputPath,
          githubToken: parsed.data.githubToken,
          jobId,
        });

        return json({ jobId }, 202);
      },
    },
  },
});
