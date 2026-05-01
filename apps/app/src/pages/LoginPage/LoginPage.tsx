import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/integrations/better-auth-client";
import { LoginPageContent } from "./LoginPageContent";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  // If the user is already authenticated, redirect them to the home page
  useEffect(() => {
    if (!isPending && session) {
      navigate({ to: "/" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (session) {
    return null;
  }

  return <LoginPageContent />;
};
