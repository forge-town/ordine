import { db } from "@repo/db";
import { createSkillsDao, createSkillsService } from "@repo/services";

const skillsDao = createSkillsDao(db);

export const skillsService = createSkillsService(skillsDao);
