import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { skillsDao } from "@repo/models";
import { SkillSchema } from "@repo/schemas";
import { createSkillsService } from "@repo/services";

const service = createSkillsService(skillsDao);

export const getSkills = createServerFn({ method: "GET" }).handler(async () => {
  await skillsDao.seedIfEmpty();
  return service.getAll();
});

export const getSkillById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createSkill = createServerFn({ method: "POST" })
  .inputValidator(SkillSchema)
  .handler(({ data }) => service.create(data));

export const updateSkill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      patch: SkillSchema.partial(),
    })
  )
  .handler(({ data }) => service.update(data.id, data.patch));

export const deleteSkill = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
