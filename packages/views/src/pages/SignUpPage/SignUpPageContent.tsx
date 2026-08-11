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

type SignUpFormValues = { name: string; email: string; password: string };

export const SignUpPageContent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signUpWithEmail } = useAuth();
  const [error, setError] = useState("");
  const signUpSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("auth.nameRequired")),
        email: z.email(t("auth.invalidEmail")),
        password: z.string().min(8, t("auth.passwordMin")),
      }),
    [t],
  );

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const loading = form.formState.isSubmitting;

  const handleSubmit = async (values: SignUpFormValues) => {
    setError("");
    const result = await signUpWithEmail({ ...values, callbackURL: "/" });
    result.match(
      () => navigate({ to: "/" }),
      (error) => setError(error.message),
    );
  };

  return (
    <AuthShell>
      <Card className="w-full shadow-float" variant="surface">
        <CardHeader className="pb-1 text-center">
          <CardTitle className="text-xl tracking-[-0.02em]">{t("auth.createAccount")}</CardTitle>
          <CardDescription className="text-[12.5px]">{t("auth.signUpDescription")}</CardDescription>
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.name")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder={t("auth.namePlaceholder")}
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <Input
                        autoComplete="new-password"
                        placeholder={t("auth.passwordPlaceholder")}
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="w-full" disabled={loading} type="submit">
                {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.hasAccount")}{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="/login">
              {t("auth.signIn")}
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
};
