import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { jobsDao } from "@repo/models";
import { JobStatusSchema } from "@/schemas";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const UpdateStatusSchema = z.object({
  status: JobStatusSchema,
  logs: z.array(z.string()).optional(),
  error: z.string().optional(),
  result: z
    .object({
      output: z.string().optional(),
      summary: z.string().optional(),
    })
    .optional(),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
});

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const job = await jobsDao.findById(params.id);
        if (!job) return errorResponse("Job not found", 404);
        return json(job);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdateStatusSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const { status: jobStatus, ...extra } = parsed.data;
        const job = await jobsDao.updateStatus(params.id, jobStatus, extra);
        if (!job) return errorResponse("Job not found", 404);
        return json(job);
      },

      DELETE: async ({ params }) => {
        const existing = await jobsDao.findById(params.id);
        if (!existing) return errorResponse("Job not found", 404);
        await jobsDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
