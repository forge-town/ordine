import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { rulesDao } from "@repo/models";
import { RuleCategorySchema, RuleSeveritySchema, RuleScriptLanguageSchema } from "@/schemas";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const CreateRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  category: RuleCategorySchema.default("custom"),
  severity: RuleSeveritySchema.default("warning"),
  checkScript: z.string().nullable().default(null),
  scriptLanguage: RuleScriptLanguageSchema.default("typescript"),
  acceptedObjectTypes: z.array(z.string()).default(["file", "folder", "project"]),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

export const Route = createFileRoute("/api/rules")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const categoryParam = url.searchParams.get("category");
        const enabledParam = url.searchParams.get("enabled");
        const enabled =
          enabledParam === "true" ? true : enabledParam === "false" ? false : undefined;

        const filter: Parameters<typeof rulesDao.findMany>[0] = {};
        if (categoryParam)
          filter.category = categoryParam as NonNullable<typeof filter>["category"];
        if (enabled !== undefined) filter.enabled = enabled;

        const rules = await rulesDao.findMany(filter);
        return json(rules);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateRuleSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const rule = await rulesDao.create(parsed.data);
        return json(rule, 201);
      },

      PUT: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateRuleSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const existing = await rulesDao.findById(parsed.data.id);
        if (existing) {
          const { id: _, ...patch } = parsed.data;
          const updated = await rulesDao.update(parsed.data.id, patch);
          return json(updated);
        }
        const rule = await rulesDao.create(parsed.data);
        return json(rule, 201);
      },
    },
  },
});
