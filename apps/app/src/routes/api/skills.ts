import { createFileRoute } from "@tanstack/react-router";
import { SkillSchema } from "@/schemas";
import { skillsDao } from "@/models/daos/skillsDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const CreateSkillSchema = SkillSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const Route = createFileRoute("/api/skills")({
  server: {
    handlers: {
      GET: async () => {
        await skillsDao.seedIfEmpty();
        const skills = await skillsDao.findMany();
        return json(skills);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateSkillSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const skill = await skillsDao.create(parsed.data);
        return json(skill, 201);
      },
    },
  },
});
