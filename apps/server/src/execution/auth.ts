import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  ExecutionPrincipalSchema,
  ORDINE_EXECUTION_API_VERSION,
  type ExecutionPrincipal,
} from "@repo/schemas";
import { executionError } from "./errors";

export type ExecutionAuthEnv = {
  Variables: { principal: ExecutionPrincipal; credentialAudience: "app" | "agent" };
};
const TokenSchema = z
  .string()
  .min(32)
  .max(4096)
  .regex(/^[A-Za-z0-9._~+/-]+=*$/u);
const TokenReaderSchema = z.custom<
  (signal: AbortSignal) => Promise<string | undefined> | string | undefined
>((value) => typeof value === "function");
export const ExecutionCredentialSchema = ExecutionPrincipalSchema.extend({
  audience: z.enum(["app", "agent"]),
  transport: z.enum(["desktop", "bearer"]),
  token: TokenSchema.optional(),
  readToken: TokenReaderSchema.optional(),
}).superRefine((value, context) => {
  if ((value.token === undefined) === (value.readToken === undefined))
    context.addIssue({ code: "custom", message: "Exactly one credential source is required" });
  if (value.audience === "agent" && value.scopes.includes("execution:approve"))
    context.addIssue({
      code: "custom",
      message: "Agent credentials cannot grant approval authority",
    });
});
export const ExecutionAuthOptionsSchema = z.strictObject({
  mode: z.enum(["desktop", "service"]),
  allowedOrigins: z
    .array(
      z.url().refine((value) => {
        const parsed = Result.fromThrowable(
          () => new URL(value),
          () => undefined,
        )();

        return (
          parsed.isOk() &&
          ["http:", "https:"].includes(parsed.value.protocol) &&
          parsed.value.origin === value
        );
      }),
    )
    .max(64)
    .default([]),
  dependencyTimeoutMs: z.number().int().min(1).max(10_000).default(1500),
  credentials: z.array(ExecutionCredentialSchema).min(1).max(16),
});
export type ExecutionAuthOptions = z.input<typeof ExecutionAuthOptionsSchema>;
const digest = (token: string) => createHash("sha256").update(token, "utf8").digest();
const duplicates = (digests: Buffer[]) => {
  const state = { repeated: false };
  for (const [left, leftDigest] of digests.entries()) {
    for (const rightDigest of digests.slice(left + 1)) {
      state.repeated = timingSafeEqual(leftDigest, rightDigest) || state.repeated;
    }
  }

  return state.repeated;
};
const readCredential = async (readToken: z.infer<typeof TokenReaderSchema>, timeoutMs: number) => {
  const controller = new AbortController();
  const timer: { current?: ReturnType<typeof setTimeout> } = {};
  const pending = Promise.resolve().then(() => readToken(controller.signal));
  const timeout = new Promise<never>((_resolve, reject) => {
    timer.current = setTimeout(() => {
      controller.abort();
      reject(new Error("Credential read deadline exceeded"));
    }, timeoutMs);
  });
  const result = await ResultAsync.fromPromise(Promise.race([pending, timeout]), () => undefined);
  clearTimeout(timer.current);

  return result;
};

/** Credential slots are supplied by the composition root, never by request bodies or Origin. */
export const createExecutionAuthMiddleware = (
  options: ExecutionAuthOptions,
): MiddlewareHandler<ExecutionAuthEnv> => {
  const configuration = ExecutionAuthOptionsSchema.safeParse(options);
  if (
    !configuration.success ||
    duplicates(
      configuration.data.credentials.flatMap((slot) => (slot.token ? [digest(slot.token)] : [])),
    )
  )
    throw new Error("Execution authentication configuration is invalid.");
  const config = configuration.data;

  return async (context, next) => {
    context.header("Cache-Control", "no-store");
    if (context.req.header("X-Ordine-Api-Version") !== String(ORDINE_EXECUTION_API_VERSION))
      return context.json(
        {
          error: executionError(
            "EXECUTION_API_VERSION_UNSUPPORTED",
            "This endpoint requires execution API version 2.",
            "authentication",
          ),
        },
        426,
      );
    const origin = context.req.header("Origin");
    if (origin !== undefined && !config.allowedOrigins.includes(origin))
      return context.json(
        {
          error: executionError(
            "EXECUTION_ORIGIN_DENIED",
            "Request origin is not trusted.",
            "authentication",
          ),
        },
        403,
      );
    const credentials = await Promise.all(
      config.credentials.map((slot) =>
        readCredential(slot.readToken ?? (() => slot.token), config.dependencyTimeoutMs),
      ),
    );
    if (credentials.some((credential) => credential.isErr()))
      return context.json(
        {
          error: executionError(
            "EXECUTION_AUTH_UNAVAILABLE",
            "Execution authentication is temporarily unavailable.",
            "authentication",
            true,
          ),
        },
        503,
      );
    const tokens = credentials.map((credential) =>
      TokenSchema.safeParse(credential.isOk() ? credential.value : undefined),
    );
    if (tokens.some((token) => !token.success))
      return context.json(
        {
          error: executionError(
            "EXECUTION_AUTH_NOT_CONFIGURED",
            "Execution authentication is not configured correctly.",
            "authentication",
          ),
        },
        503,
      );
    const expectedDigests = tokens.map((token) => digest(token.success ? token.data : ""));
    if (duplicates(expectedDigests))
      return context.json(
        {
          error: executionError(
            "EXECUTION_AUTH_CONFIG_INVALID",
            "Execution authentication configuration is invalid.",
            "authentication",
          ),
        },
        503,
      );
    const bearer = context.req.header("Authorization");
    const submitted = {
      desktop: TokenSchema.safeParse(context.req.header("X-Desktop-Token")),
      bearer: TokenSchema.safeParse(bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined),
    };
    const actualDigests = {
      desktop: digest(submitted.desktop.success ? submitted.desktop.data : ""),
      bearer: digest(submitted.bearer.success ? submitted.bearer.data : ""),
    };
    const matches = config.credentials.filter((slot, index) => {
      const equal = timingSafeEqual(expectedDigests[index]!, actualDigests[slot.transport]);

      return equal && submitted[slot.transport].success;
    });
    if (matches.length !== 1)
      return context.json(
        {
          error: executionError(
            "EXECUTION_UNAUTHORIZED",
            "Unauthorized or ambiguous execution credentials.",
            "authentication",
          ),
        },
        401,
      );
    const selected = matches[0]!;
    context.set(
      "principal",
      ExecutionPrincipalSchema.parse({
        subjectId: selected.subjectId,
        workspaceId: selected.workspaceId,
        scopes: selected.scopes,
      }),
    );
    context.set("credentialAudience", selected.audience);
    await next();
  };
};
