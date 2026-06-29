import type { AuthCapabilities } from "@repo/views/auth";
import {
  useSession,
  signInWithEmail,
  signUpWithEmail,
  signInWithGitHub,
  signInWithGoogle,
} from "@/integrations/better-auth-client";

// Web auth handlers injected into @repo/views via AuthProvider.
export const webAuth: AuthCapabilities = {
  useSession,
  signInWithEmail,
  signUpWithEmail,
  signInWithGitHub,
  signInWithGoogle,
};
