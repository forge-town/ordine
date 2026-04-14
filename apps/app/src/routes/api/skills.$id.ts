import { createFileRoute } from "@tanstack/react-router";
import { SkillSchema } from "@/schemas";
import { skillsDao } from "@repo/models";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const UpdateSkillSchema = SkillSchema.partial().omit({ id: true });

export const Route = createFileRoute("/api/skills/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const skill = await skillsDao.findById(params.id);
        if (!skill) return errorResponse("Skill not found", 404);
        return json(skill);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdateSkillSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const skill = await skillsDao.update(params.id, parsed.data);
        return json(skill);
      },

      DELETE: async ({ params }) => {
        const existing = await skillsDao.findById(params.id);
        if (!existing) return errorResponse("Skill not found", 404);
        await skillsDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
