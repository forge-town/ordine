import { skillsDao } from "@repo/models";
import { createSkillsService } from "@repo/services";

export const skillsService = createSkillsService(skillsDao);
