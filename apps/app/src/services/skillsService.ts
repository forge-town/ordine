import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { skillsDao } from "@/models/daos/skillsDao";

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

const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
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
