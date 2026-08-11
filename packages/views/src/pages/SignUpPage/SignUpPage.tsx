import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth";
import { AuthShell } from "../../components/AuthShell";
import { SignUpPageContent } from "./SignUpPageContent";

export const SignUpPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { useSession } = useAuth();
  const { data: session, isPending } = useSession();

  // If the user is already authenticated, redirect them to the home page
  useEffect(() => {
    if (!isPending && session) {
      navigate({ to: "/" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <AuthShell>
        <div className="flex items-center justify-center gap-2 rounded-lg bg-surface px-4 py-5 text-sm text-muted-foreground shadow-soft ring-1 ring-border">
          <Loader2 className="size-4 animate-spin" />
          {t("common.loading")}
        </div>
      </AuthShell>
    );
  }

  if (session) {
    return null;
  }

  return <SignUpPageContent />;
};
