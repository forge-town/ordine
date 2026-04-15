import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { rulesDao } from "@repo/models";
import { RuleCategorySchema, RuleSeveritySchema, RuleScriptLanguageSchema } from "@repo/schemas";
import { createRulesService } from "@repo/services";

const service = createRulesService(rulesDao);

export const getRules = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        category: RuleCategorySchema.optional(),
        enabled: z.boolean().optional(),
      })
      .optional()
  )
  .handler(({ data }) => service.getAll(data ?? {}));

export const getRuleById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createRule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
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
    })
  )
  .handler(({ data }) => service.create(data));

export const updateRule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      category: RuleCategorySchema.optional(),
      severity: RuleSeveritySchema.optional(),
      checkScript: z.string().nullable().optional(),
      scriptLanguage: RuleScriptLanguageSchema.optional(),
      acceptedObjectTypes: z.array(z.string()).optional(),
      enabled: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    })
  )
  .handler(({ data }) => {
    const { id, ...rest } = data;
    return service.update(id, rest);
  });

export const toggleRule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), enabled: z.boolean() }))
  .handler(({ data }) => service.toggleEnabled(data.id, data.enabled));

export const deleteRule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
