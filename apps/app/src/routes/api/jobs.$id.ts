import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { jobsDao } from "@/models/daos/jobsDao";
import { JobStatusSchema } from "@/schemas";

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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const job = await jobsDao.findById(params.id);
        if (!job) return error("Job not found", 404);
        return json(job);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdateStatusSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const { status: jobStatus, ...extra } = parsed.data;
        const job = await jobsDao.updateStatus(params.id, jobStatus, extra);
        if (!job) return error("Job not found", 404);
        return json(job);
      },

      DELETE: async ({ params }) => {
        const existing = await jobsDao.findById(params.id);
        if (!existing) return error("Job not found", 404);
        await jobsDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
