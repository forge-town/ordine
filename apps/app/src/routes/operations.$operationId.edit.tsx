import { createFileRoute } from "@tanstack/react-router";
import { OperationEditPage } from "@/pages/OperationEditPage";
import { getOperationById } from "@/services/operationsService";
import { getSkills } from "@/services/skillsService";

export const Route = createFileRoute("/operations/$operationId/edit")({
  loader: async ({ params }) => {
    const [operation, skills] = await Promise.all([
      getOperationById({ data: { id: params.operationId } }),
      getSkills(),
    ]);
    return { operation, skills };
  },
  component: OperationEditPage,
});
