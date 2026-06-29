import { createContext, useContext, type ReactNode } from "react";
import type { ResultAsync } from "neverthrow";

// Seam for injecting client-specific auth. @repo/views must not reference
// better-auth (or any client auth implementation) directly; each app provides
// its own handlers via AuthProvider.

export interface AuthError {
  message: string;
}

export interface AuthSessionState {
  data: unknown | null;
  isPending: boolean;
}

export interface SignInWithEmailInput {
  email: string;
  password: string;
  callbackURL?: string;
}

export interface SignUpWithEmailInput {
  name: string;
  email: string;
  password: string;
  callbackURL?: string;
}

export interface AuthCapabilities {
  // Implementations must return a stable hook reference (e.g. a module-level const).
  useSession: () => AuthSessionState;
  signInWithEmail: (input: SignInWithEmailInput) => ResultAsync<unknown, AuthError>;
  signUpWithEmail: (input: SignUpWithEmailInput) => ResultAsync<unknown, AuthError>;
  signInWithGitHub: (callbackURL?: string) => unknown;
  signInWithGoogle: (callbackURL?: string) => unknown;
}

const AuthContext = createContext<AuthCapabilities | null>(null);

interface AuthProviderProps {
  value: AuthCapabilities;
  children: ReactNode;
}

export const AuthProvider = ({ value, children }: AuthProviderProps) => {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthCapabilities => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
};
