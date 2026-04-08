import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { rulesDao } from "@/models/daos/rulesDao";
import { RuleCategorySchema, RuleSeveritySchema } from "@/schemas";

const CreateRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  category: RuleCategorySchema.default("custom"),
  severity: RuleSeveritySchema.default("warning"),
  pattern: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/rules")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const categoryParam = url.searchParams.get("category");
        const enabledParam = url.searchParams.get("enabled");
        const enabled =
          enabledParam === "true"
            ? true
            : enabledParam === "false"
              ? false
              : undefined;

        const filter: Parameters<typeof rulesDao.findMany>[0] = {};
        if (categoryParam)
          filter.category = categoryParam as NonNullable<
            typeof filter
          >["category"];
        if (enabled !== undefined) filter.enabled = enabled;

        const rules = await rulesDao.findMany(filter);
        return json(rules);
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreateRuleSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const rule = await rulesDao.create(parsed.data);
        return json(rule, 201);
      },
    },
  },
});
