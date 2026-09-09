import { readFile } from "node:fs/promises";
import { err, ok, ResultAsync } from "neverthrow";
import { z } from "zod";
import { ExecutionErrorSchema } from "@repo/schemas";
import { envSchema } from "./integrations/env";

export const ApiFailureSchema = z.object({
  ok: z.literal(false),
  status: z.number().int().nonnegative(),
  code: z.string(),
  message: z.string().max(512),
  error: ExecutionErrorSchema.optional(),
});
export type ApiFailure = z.infer<typeof ApiFailureSchema>;

export const apiFailure = (code: string, message: string, status = 0): ApiFailure => ({
  ok: false,
  status,
  code,
  message,
});

const TokenSchema = z
  .string()
  .min(32)
  .max(4096)
  .regex(/^[A-Za-z0-9._~+/-]+=*$/);

// Only the explicitly selected identity is interpreted. Files are read on every request.
export const resolveApiAuthentication = async (environment: NodeJS.ProcessEnv = process.env) => {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success)
    return err(apiFailure("API_CONFIG_INVALID", "CLI API configuration is invalid."));
  const env = parsed.data;
  const token =
    env.ORDINE_AUTH_MODE === "bearer" ? env.ORDINE_AGENT_API_TOKEN : env.ORDINE_DESKTOP_AUTH_TOKEN;
  const file =
    env.ORDINE_AUTH_MODE === "bearer"
      ? env.ORDINE_AGENT_API_TOKEN_FILE
      : env.ORDINE_DESKTOP_AUTH_TOKEN_FILE;
  if (token !== undefined && file !== undefined)
    return err(
      apiFailure(
        "AUTH_CONFIG_CONFLICT",
        "Configure either a token or a token file for the selected identity, not both.",
      ),
    );
  if (token === undefined && file === undefined)
    return err(
      apiFailure(
        "AUTH_NOT_CONFIGURED",
        "Authentication is not configured for the selected identity.",
      ),
    );
  if (file !== undefined && file.trim().length === 0)
    return err(
      apiFailure("AUTH_FILE_UNREADABLE", "The configured authentication file cannot be read."),
    );
  const loaded =
    file === undefined
      ? ok(token)
      : await ResultAsync.fromPromise(readFile(file, "utf8"), () =>
          apiFailure("AUTH_FILE_UNREADABLE", "The configured authentication file cannot be read."),
        );
  if (loaded.isErr()) return loaded;
  // A single file line ending is accepted; spaces and embedded lines are invalid.
  const value = file === undefined ? loaded.value : loaded.value?.replace(/\r?\n$/, "");
  if (!TokenSchema.safeParse(value).success || value === undefined)
    return err(
      apiFailure(
        "AUTH_TOKEN_INVALID",
        "The configured authentication token has an invalid format.",
      ),
    );
  const headers: Record<string, string> =
    env.ORDINE_AUTH_MODE === "bearer"
      ? { Authorization: `Bearer ${value}` }
      : { "X-Desktop-Token": value };

  return ok({ baseUrl: env.ORDINE_API_URL, headers });
};

export const redactApiMessage = (message: string, secrets: readonly string[] = []): string => {
  const redacted = secrets
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), message);

  const safeText = redacted
    .replaceAll(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replaceAll(/((?:token|secret|password|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]");

  return Array.from(safeText.slice(0, 512), (character) =>
    (character.codePointAt(0) ?? 0) < 32 ? " " : character,
  ).join("");
};
