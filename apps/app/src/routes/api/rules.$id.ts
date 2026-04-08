import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { rulesDao } from "@/models/daos/rulesDao";
import { RuleCategorySchema, RuleSeveritySchema } from "@/schemas";

const UpdateRuleSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: RuleCategorySchema.optional(),
  severity: RuleSeveritySchema.optional(),
  pattern: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/rules/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rule = await rulesDao.findById(params.id);
        if (!rule) return error("Rule not found", 404);
        return json(rule);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdateRuleSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const rule = await rulesDao.update(params.id, parsed.data);
        return json(rule);
      },

      DELETE: async ({ params }) => {
        const existing = await rulesDao.findById(params.id);
        if (!existing) return error("Rule not found", 404);
        await rulesDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
