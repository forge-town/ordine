import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod/v4";
import { CanvasPage } from "@/pages/CanvasPage";
import { useSession } from "@/integrations/better-auth-client";

const CanvasRouteComponent = () => {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <CanvasPage />;
};

export const Route = createFileRoute("/canvas")({
  head: () => ({
    meta: [{ title: "Canvas | Ordine" }],
  }),
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  component: CanvasRouteComponent,
});
