import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { rulesDao } from "@/models/daos/rulesDao";
import { RuleCategorySchema, RuleSeveritySchema, ScriptLanguageSchema } from "@/schemas";

export const getRules = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        category: RuleCategorySchema.optional(),
        enabled: z.boolean().optional(),
      })
      .optional()
  )
  .handler(({ data }) => rulesDao.findMany(data ?? {}));

export const getRuleById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => rulesDao.findById(data.id));

export const createRule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().default(null),
      category: RuleCategorySchema.default("custom"),
      severity: RuleSeveritySchema.default("warning"),
      checkScript: z.string().nullable().default(null),
      scriptLanguage: ScriptLanguageSchema.default("bash"),
      acceptedObjectTypes: z.array(z.string()).default(["file", "folder", "project"]),
      enabled: z.boolean().default(true),
      tags: z.array(z.string()).default([]),
    })
  )
  .handler(({ data }) => rulesDao.create(data));

export const updateRule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      category: RuleCategorySchema.optional(),
      severity: RuleSeveritySchema.optional(),
      checkScript: z.string().nullable().optional(),
      scriptLanguage: ScriptLanguageSchema.optional(),
      acceptedObjectTypes: z.array(z.string()).optional(),
      enabled: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    })
  )
  .handler(({ data }) => {
    const { id, ...rest } = data;
    return rulesDao.update(id, rest);
  });

export const toggleRule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), enabled: z.boolean() }))
  .handler(({ data }) => rulesDao.toggleEnabled(data.id, data.enabled));

export const deleteRule = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => rulesDao.delete(data.id));
