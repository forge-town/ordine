import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { rulesDao } from "@/models/daos/rulesDao";
import { RuleCategorySchema, RuleSeveritySchema } from "@/schemas";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const UpdateRuleSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: RuleCategorySchema.optional(),
  severity: RuleSeveritySchema.optional(),
  pattern: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/api/rules/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rule = await rulesDao.findById(params.id);
        if (!rule) return errorResponse("Rule not found", 404);
        return json(rule);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdateRuleSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const rule = await rulesDao.update(params.id, parsed.data);
        return json(rule);
      },

      DELETE: async ({ params }) => {
        const existing = await rulesDao.findById(params.id);
        if (!existing) return errorResponse("Rule not found", 404);
        await rulesDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
