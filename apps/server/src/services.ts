import { db } from "@repo/db";
import { createSkillsDao } from "@repo/models";
import { createSkillsService } from "@repo/services";

const skillsDao = createSkillsDao(db);

export const skillsService = createSkillsService(skillsDao);
