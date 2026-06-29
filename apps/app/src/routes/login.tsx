import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@repo/views/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Login | Ordine" }],
  }),
  component: LoginPage,
});
