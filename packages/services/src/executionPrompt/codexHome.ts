import { readFile, mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parse, stringify } from "smol-toml";
import { Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import { ExecutionPromptError, parsePromptJson, requirePromptResult } from "./errors";

const ConfigSchema = z.object({
  model_provider: z.string().min(1).optional(),
  model_providers: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  cli_auth_credentials_store: z.string().optional(),
});
const ProviderSchema = z.strictObject({
  name: z.string(),
  base_url: z.string().url().optional(),
  wire_api: z.literal("responses").optional(),
  env_key: z.string().optional(),
  env_key_instructions: z.string().optional(),
  experimental_bearer_token: z.string().optional(),
  requires_openai_auth: z.boolean().optional(),
  http_headers: z.record(z.string(), z.string()).optional(),
  env_http_headers: z.record(z.string(), z.string()).optional(),
  query_params: z.record(z.string(), z.string()).optional(),
  supports_websockets: z.boolean().optional(),
  request_max_retries: z.number().int().nonnegative().optional(),
  stream_max_retries: z.number().int().nonnegative().optional(),
  stream_idle_timeout_ms: z.number().int().positive().optional(),
  websocket_connect_timeout_ms: z.number().int().positive().optional(),
});
const readOptional = async (path: string) => {
  const size = await ResultAsync.fromPromise(stat(path), (error) => error as NodeJS.ErrnoException);
  if (size.isErr()) {
    if (size.error.code === "ENOENT") return undefined;
    throw new ExecutionPromptError(
      "PROMPT_AUTH_UNAVAILABLE",
      "Runtime authentication configuration is inaccessible.",
      "preparation",
    );
  }
  if (!size.value.isFile() || size.value.size > 1024 * 1024)
    throw new ExecutionPromptError(
      "PROMPT_CONFIG_LIMIT",
      "Runtime configuration exceeds its supported size.",
      "preparation",
    );

  return readFile(path, "utf8");
};

/** Read once so the checked identity and the copied credentials describe the same profile. */
const loadCodexProfile = async () => {
  const source = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const text = await readOptional(join(source, "config.toml"));
  const parsed = requirePromptResult(
    Result.fromThrowable(
      () => ConfigSchema.parse(text ? parse(text) : {}),
      () =>
        new ExecutionPromptError(
          "PROMPT_PROVIDER_INVALID",
          "Runtime provider configuration is unsupported.",
          "preparation",
        ),
    )(),
  );
  const providerId = parsed.model_provider ?? "openai";
  const sourceProvider = parsed.model_providers?.[providerId];
  const provider = sourceProvider ? ProviderSchema.safeParse(sourceProvider) : undefined;
  if ((provider && !provider.success) || (!sourceProvider && providerId !== "openai"))
    throw new ExecutionPromptError(
      "PROMPT_PROVIDER_INVALID",
      "Selected runtime provider is unsupported.",
      "preparation",
    );
  const selected = provider?.success ? provider.data : undefined;
  const environment: Record<string, string> = {};
  const authentication: { content?: string } = {};
  const secrets: string[] = [
    selected?.experimental_bearer_token,
    ...Object.values(selected?.http_headers ?? {}),
    ...Object.values(selected?.query_params ?? {}),
  ].filter((value): value is string => !!value);
  // Transport settings are required on hosts that route provider traffic through a proxy.
  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "no_proxy",
  ]) {
    const value = process.env[key];
    if (value) {
      environment[key] = value;
      secrets.push(value);
    }
  }
  for (const key of [selected?.env_key, ...Object.values(selected?.env_http_headers ?? {})]) {
    if (!key) continue;
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) ||
      /^(?:PATH|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|SYSTEMROOT|TEMP|TMP|NODE_OPTIONS|CODEX_.*|ORDINE_.*|OD_.*|DATABASE_.*|PG.*|POSTGRES.*|REDIS.*|MYSQL.*)$/iu.test(
        key,
      )
    )
      throw new ExecutionPromptError(
        "PROMPT_PROVIDER_ENV_UNSUPPORTED",
        "Provider requests a protected service environment variable.",
        "preparation",
      );
    const value = process.env[key];
    if (!value)
      throw new ExecutionPromptError(
        "PROMPT_AUTH_UNAVAILABLE",
        "Selected provider credential is unavailable.",
        "preparation",
      );
    environment[key] = value;
    secrets.push(value);
  }
  const usesOpenAIAuth = selected?.requires_openai_auth ?? providerId === "openai";
  if (usesOpenAIAuth) {
    const authText = await readOptional(join(source, "auth.json"));
    if (authText) {
      const auth = z
        .object({
          auth_mode: z.string().optional(),
          OPENAI_API_KEY: z.string().nullable().optional(),
          tokens: z.record(z.string(), z.unknown()).nullable().optional(),
          last_refresh: z.string().nullable().optional(),
        })
        .safeParse(parsePromptJson(authText));
      if (!auth.success)
        throw new ExecutionPromptError(
          "PROMPT_AUTH_UNAVAILABLE",
          "Runtime authentication data is unsupported.",
          "preparation",
        );
      if (auth.data.OPENAI_API_KEY) secrets.push(auth.data.OPENAI_API_KEY);
      for (const value of Object.values(auth.data.tokens ?? {}))
        if (typeof value === "string" && value) secrets.push(value);
      authentication.content = JSON.stringify(auth.data);
    } else if (process.env.OPENAI_API_KEY) {
      environment.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      secrets.push(process.env.OPENAI_API_KEY);
    } else
      throw new ExecutionPromptError(
        "PROMPT_AUTH_UNAVAILABLE",
        "No supported Codex login or selected provider credential is available.",
        "preparation",
      );
  }
  const config = {
    model_provider: providerId,
    ...(selected ? { model_providers: { [providerId]: selected } } : {}),
    approval_policy: "never",
    suppress_unstable_features_warning: true,
    sandbox_mode: "read-only",
    web_search: "disabled",
    cli_auth_credentials_store: "file",
    project_doc_max_bytes: 0,
    shell_environment_policy: { inherit: "none" },
  };

  return {
    // Only the opaque digest enters PreparedRun; no key, token, URL or environment is persisted.
    // Rotation deliberately requires a new request instead of changing an approved identity.
    credentialRef: `codex-${createHash("sha256")
      .update(JSON.stringify({ source, providerId, selected, environment, authentication }))
      .digest("hex")}`,
    config,
    authentication,
    environment,
    redact: (text: string) =>
      secrets.reduce((value, secret) => value.replaceAll(secret, "[redacted]"), text),
  };
};

export const inspectCodexCredentialRef = async () => {
  const profile = await loadCodexProfile();

  return profile.credentialRef;
};

/** Copies the currently authorized profile only when it matches the approved opaque reference. */
export const prepareCodexHome = async (home: string, expectedCredentialRef: string) => {
  const profile = await loadCodexProfile();
  if (profile.credentialRef !== expectedCredentialRef)
    throw new ExecutionPromptError(
      "PROMPT_CREDENTIAL_CHANGED",
      "Provider or credentials changed after preparation; submit a new request for approval.",
      "preparation",
    );
  await mkdir(home, { recursive: true, mode: 0o700 });
  if (profile.authentication.content)
    await writeFile(join(home, "auth.json"), profile.authentication.content, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
  await writeFile(join(home, "config.toml"), stringify(profile.config), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });

  const environment: Record<string, string> = { ...profile.environment, CODEX_HOME: home };

  return {
    environment,
    redact: profile.redact,
  };
};
export const cleanupCodexCredentials = async (home: string) => {
  for (const file of ["auth.json", "config.toml"]) {
    const result = await ResultAsync.fromPromise(
      unlink(join(home, file)),
      (error) => error as NodeJS.ErrnoException,
    );
    if (result.isErr() && result.error.code !== "ENOENT")
      throw new ExecutionPromptError(
        "PROMPT_CREDENTIAL_CLEANUP_FAILED",
        "Attempt credentials could not be removed.",
      );
  }
};
