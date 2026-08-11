import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/form";
import { Input } from "@repo/ui/input";
import { useAuth } from "../../auth";
import { AuthShell } from "../../components/AuthShell";

type LoginFormValues = { email: string; password: string };

export const LoginPageContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signInWithEmail, signInWithGitHub, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.email(t("auth.invalidEmail")),
        password: z.string().min(1, t("auth.passwordRequired")),
      }),
    [t],
  );

  const handleGitHubClick = () => signInWithGitHub("/");
  const handleGoogleClick = () => signInWithGoogle("/");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const loading = form.formState.isSubmitting;

  const handleSubmit = async (values: LoginFormValues) => {
    setError("");
    const result = await signInWithEmail({ ...values, callbackURL: "/" });
    result.match(
      () => navigate({ to: "/" }),
      (error) => setError(error.message),
    );
  };

  return (
    <AuthShell>
      <Card className="w-full shadow-float" variant="surface">
        <CardHeader className="pb-1 text-center">
          <CardTitle className="text-xl tracking-[-0.02em]">{t("auth.signIn")}</CardTitle>
          <CardDescription className="text-[12.5px]">{t("auth.signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="email"
                        placeholder="you@example.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.password")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="current-password" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="w-full" disabled={loading} type="submit">
                {loading ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
            </form>
          </Form>

          <div className="mt-4 space-y-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted-foreground">
                  {t("auth.continueWith")}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={handleGitHubClick}>
                GitHub
              </Button>
              <Button type="button" variant="outline" onClick={handleGoogleClick}>
                Google
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="/sign-up">
              {t("auth.signUp")}
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
};
