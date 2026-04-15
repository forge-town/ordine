import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { skillsDao } from "@repo/models";
import { SkillSchema } from "@repo/schemas";

export const getSkills = createServerFn({ method: "GET" }).handler(async () => {
  // 确保初始化 seed 数据
  await skillsDao.seedIfEmpty();
  return skillsDao.findMany();
});

export const getSkillById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    return skillsDao.findById(data.id);
  });

export const createSkill = createServerFn({ method: "POST" })
  .inputValidator(SkillSchema)
  .handler(async ({ data }) => {
    return skillsDao.create(data);
  });

export const updateSkill = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      patch: SkillSchema.partial(),
    })
  )
  .handler(async ({ data }) => {
    await skillsDao.update(data.id, data.patch);
  });

export const deleteSkill = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await skillsDao.delete(data.id);
  });
