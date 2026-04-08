import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { jobsDao } from "@/models/daos/jobsDao";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { runPipeline } from "@/services/pipelineRunnerService";

const RunPipelineSchema = z.object({
  inputPath: z.string().optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) => json({ error: message }, status);

export const Route = createFileRoute("/api/pipelines/$id/run")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const pipeline = await pipelinesDao.findById(params.id);
        if (!pipeline) return error("Pipeline not found", 404);

        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const parsed = RunPipelineSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
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
          jobId,
        });

        return json({ jobId }, 202);
      },
    },
  },
});
