import { createAuthClient } from "better-auth/react";
import { ResultAsync, err, ok } from "neverthrow";

export const authClient = createAuthClient({
  baseURL:
    globalThis.window === undefined ? "http://localhost:9430" : globalThis.window.location.origin,
  fetchOptions: { credentials: "include" },
  session: { refreshOnWindowFocus: true, refreshInterval: 60 * 10 },
});

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export const signUpWithEmail = (input: {
  email: string;
  password: string;
  name: string;
  callbackURL?: string;
}) => {
  return ResultAsync.fromPromise(
    authClient.signUp.email({
      ...input,
      callbackURL: input.callbackURL ?? "/",
    }),
    (e) => new AuthError(e instanceof Error ? e.message : "Signup request failed"),
  ).andThen(({ data, error }) => {
    if (error) return err(new AuthError(error.message ?? "Signup failed"));

    return ok(data);
  });
};

export const signInWithEmail = (input: {
  email: string;
  password: string;
  callbackURL?: string;
}) => {
  return ResultAsync.fromPromise(
    authClient.signIn.email({
      ...input,
      callbackURL: input.callbackURL ?? "/",
    }),
    (e) => new AuthError(e instanceof Error ? e.message : "Login request failed"),
  ).andThen(({ data, error }) => {
    if (error) return err(new AuthError(error.message ?? "Login failed"));

    return ok(data);
  });
};

export const signInWithGitHub = (callbackURL = "/") =>
  authClient.signIn.social({
    provider: "github",
    callbackURL,
    errorCallbackURL: "/login",
  });

export const signInWithGoogle = (callbackURL = "/") =>
  authClient.signIn.social({
    provider: "google",
    callbackURL,
    errorCallbackURL: "/login",
  });

export const signOut = (cb?: () => void) => authClient.signOut({ fetchOptions: { onSuccess: cb } });

export const { useSession, getSession } = authClient;
