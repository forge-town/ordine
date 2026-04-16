import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { rulesService } from "../services";
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
    .query(({ input }) => rulesService.getAll(input ?? {})),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => rulesService.getById(input.id)),

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
    .mutation(({ input }) => rulesService.create(input)),

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

      return rulesService.update(id, rest);
    }),

  toggle: publicProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => rulesService.toggleEnabled(input.id, input.enabled)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => rulesService.delete(input.id)),
});
