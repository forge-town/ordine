import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@repo/db";
import { usersTable, sessionsTable, accountsTable, verificationsTable } from "@repo/db-schema";
import { getServerEnv } from "@/integrations/server-env";

const {
  BETTER_AUTH_SECRET,
  VITE_APP_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  NODE_ENV,
} = getServerEnv();

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: usersTable,
      sessions: sessionsTable,
      accounts: accountsTable,
      verifications: verificationsTable,
    },
  }),
  baseURL: VITE_APP_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: {
      hash: (pwd) => bcrypt.hash(pwd, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  socialProviders: {
    github: GITHUB_CLIENT_ID
      ? {
          clientId: GITHUB_CLIENT_ID,
          clientSecret: GITHUB_CLIENT_SECRET ?? "",
          redirectURI: `${VITE_APP_URL}/api/auth/callback/github`,
        }
      : undefined,
    google: GOOGLE_CLIENT_ID
      ? {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET ?? "",
          redirectURI: `${VITE_APP_URL}/api/auth/callback/google`,
        }
      : undefined,
  },
  trustedOrigins: [
    VITE_APP_URL,
    ...(NODE_ENV === "development"
      ? [
          "http://localhost:9430",
          "http://localhost:9431",
          "http://localhost:9432",
          "http://localhost:9433",
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 5,
    cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 7 },
  },
  advanced: { useSecureCookies: NODE_ENV === "production" },
});
