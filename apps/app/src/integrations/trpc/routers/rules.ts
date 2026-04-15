import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { rulesDao } from "@repo/models";
import { RuleCategorySchema, RuleSeveritySchema, RuleScriptLanguageSchema } from "@repo/schemas";

export const rulesRouter = router({
  getMany: publicProcedure
    .input(
      z
        .object({
          category: RuleCategorySchema.optional(),
          enabled: z.boolean().optional(),
        })
        .optional()
    )
    .query(({ input }) => rulesDao.findMany(input ?? {})),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => rulesDao.findById(input.id)),

  create: publicProcedure
    .input(
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
    .mutation(({ input }) => rulesDao.create(input)),

  update: publicProcedure
    .input(
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
    .mutation(({ input }) => {
      const { id, ...rest } = input;
      return rulesDao.update(id, rest);
    }),

  toggle: publicProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => rulesDao.toggleEnabled(input.id, input.enabled)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => rulesDao.delete(input.id)),
});
