import { createFileRoute } from "@tanstack/react-router";
import { SkillSchema } from "@/schemas";
import { skillsDao } from "@/models/daos/skillsDao";

const UpdateSkillSchema = SkillSchema.partial().omit({ id: true });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/skills/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const skill = await skillsDao.findById(params.id);
        if (!skill) return error("Skill not found", 404);
        return json(skill);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdateSkillSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const skill = await skillsDao.update(params.id, parsed.data);
        return json(skill);
      },

      DELETE: async ({ params }) => {
        const existing = await skillsDao.findById(params.id);
        if (!existing) return error("Skill not found", 404);
        await skillsDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
