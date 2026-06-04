import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../init";
import { skillsService } from "../services";
import { SkillSchema } from "@repo/schemas";

const SkillImportCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string(),
  path: z.string(),
});

export const skillsRouter = router({
  getMany: publicProcedure.query(async () => {
    await skillsService.seedIfEmpty();

    return skillsService.getAll();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => skillsService.getById(input.id)),

  create: publicProcedure.input(SkillSchema).mutation(({ input }) => skillsService.create(input)),

  previewImport: publicProcedure
    .input(z.object({ rootPath: z.string().min(1) }))
    .query(({ input }) => skillsService.previewImport(input)),

  importCandidates: publicProcedure
    .input(z.object({ candidates: z.array(SkillImportCandidateSchema) }))
    .mutation(({ input }) => skillsService.importCandidates(input.candidates)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        patch: SkillSchema.partial(),
      }),
    )
    .mutation(({ input }) => skillsService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => skillsService.delete(input.id)),

  draftOperation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const skill = await skillsService.getById(input.id);
      if (!skill) throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });

      return skillsService.buildDraftOperation(skill);
    }),

  analyze: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const skill = await skillsService.getById(input.id);
      if (!skill) throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });

      return skillsService.analyzeSkill(skill);
    }),
});
