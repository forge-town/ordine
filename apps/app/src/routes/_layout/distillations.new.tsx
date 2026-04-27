import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { distillationStudioSearchSchema } from "./distillation-studio";

const LegacyDistillationStudioRedirect = () => {
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    void navigate({
      to: "/distillation-studio",
      search,
      replace: true,
    });
  }, [navigate, search]);

  return null;
};

export const Route = createFileRoute("/_layout/distillations/new")({
  validateSearch: distillationStudioSearchSchema,
  component: LegacyDistillationStudioRedirect,
});
