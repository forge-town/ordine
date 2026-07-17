import { createFileRoute } from "@tanstack/react-router";
import { SignUpPage } from "@repo/views/SignUpPage";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [{ title: "Sign Up | Ordine" }],
  }),
  component: SignUpPage,
});
