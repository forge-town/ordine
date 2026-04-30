import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:9430",
  fetchOptions: { credentials: "include" },
  session: { refreshOnWindowFocus: true, refreshInterval: 60 * 10 },
});

export const signUpWithEmail = async (input: {
  email: string;
  password: string;
  name: string;
  callbackURL?: string;
}) => {
  const { data, error } = await authClient.signUp.email({
    ...input,
    callbackURL: input.callbackURL ?? "/",
  });
  if (error) {
    throw error;
  }
  return data;
};

export const signInWithEmail = async (input: {
  email: string;
  password: string;
  callbackURL?: string;
}) => {
  const { data, error } = await authClient.signIn.email({
    ...input,
    callbackURL: input.callbackURL ?? "/",
  });
  if (error) {
    throw error;
  }
  return data;
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

export const signOut = (cb?: () => void) =>
  authClient.signOut({ fetchOptions: { onSuccess: cb } });

export const { useSession, getSession } = authClient;
