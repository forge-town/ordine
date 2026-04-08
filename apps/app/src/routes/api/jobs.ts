import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { jobsDao } from "@/models/daos/jobsDao";
import { JobStatusSchema, JobTypeSchema } from "@/schemas";

const CreateJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: JobTypeSchema.default("custom"),
  workId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  pipelineId: z.string().nullable().default(null),
  logs: z.array(z.string()).default([]),
  result: z
    .object({
      output: z.string().optional(),
      summary: z.string().optional(),
    })
    .nullable()
    .default(null),
  error: z.string().nullable().default(null),
  status: JobStatusSchema.default("queued"),
  startedAt: z.number().nullable().default(null),
  finishedAt: z.number().nullable().default(null),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) => json({ error: message }, status);

export const Route = createFileRoute("/api/jobs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const statusParam = url.searchParams.get("status");
        const workId = url.searchParams.get("workId") ?? undefined;
        const projectId = url.searchParams.get("projectId") ?? undefined;

        const filter: Parameters<typeof jobsDao.findMany>[0] = {};
        if (statusParam) filter.status = statusParam as NonNullable<typeof filter>["status"];
        if (workId) filter.workId = workId;
        if (projectId) filter.projectId = projectId;

        const jobs = await jobsDao.findMany(filter);
        return json(jobs);
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreateJobSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const job = await jobsDao.create(parsed.data);
        return json(job, 201);
      },
    },
  },
});
