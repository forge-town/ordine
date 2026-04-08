import { createFileRoute } from "@tanstack/react-router";
import { SkillSchema } from "@/schemas";
import { skillsDao } from "@/models/daos/skillsDao";

const CreateSkillSchema = SkillSchema.omit({
  createdAt: true,
  updatedAt: true,
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) => json({ error: message }, status);

export const Route = createFileRoute("/api/skills")({
  server: {
    handlers: {
      GET: async () => {
        await skillsDao.seedIfEmpty();
        const skills = await skillsDao.findMany();
        return json(skills);
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreateSkillSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const skill = await skillsDao.create(parsed.data);
        return json(skill, 201);
      },
    },
  },
});
