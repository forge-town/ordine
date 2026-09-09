import { Result, ResultAsync } from "neverthrow";
import { ExecutionErrorSchema, ORDINE_EXECUTION_API_VERSION } from "@repo/schemas";
import { apiFailure, redactApiMessage, resolveApiAuthentication, type ApiFailure } from "./auth";

type ApiResult<T> = { ok: true; data: T } | ApiFailure;
type ClientOptions = { environment?: () => NodeJS.ProcessEnv; timeoutMs?: number };

export const createApiClient = ({
  environment = () => process.env,
  timeoutMs = 15_000,
}: ClientOptions = {}) => {
  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    responseType: "json" | "bytes" | "none" = "json",
  ): Promise<ApiResult<T>> => {
    const auth = await resolveApiAuthentication(environment());
    if (auth.isErr()) return auth.error;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
      return apiFailure(
        "API_PATH_INVALID",
        "API request path must be relative to the configured endpoint.",
      );
    const headers = auth.value.headers;
    if (path.startsWith("/api/v2/"))
      headers["X-Ordine-Api-Version"] = String(ORDINE_EXECUTION_API_VERSION);
    const serialized = Result.fromThrowable(
      () => (body === undefined ? undefined : JSON.stringify(body)),
      () => apiFailure("API_REQUEST_INVALID", "API request body cannot be serialized."),
    )();
    if (serialized.isErr()) return serialized.error;
    if (
      path.startsWith("/api/v2/") &&
      serialized.value !== undefined &&
      Buffer.byteLength(serialized.value, "utf8") > 12 * 1024 * 1024
    )
      return apiFailure("API_REQUEST_INVALID", "Execution JSON request exceeds 12 MiB.");
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const requested = await ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        fetch(`${auth.value.baseUrl.replace(/\/$/, "")}${path}`, {
          method,
          headers,
          body: serialized.value,
          redirect: "manual",
          signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, 60_000))),
        }),
      ),
      () => apiFailure("API_NETWORK_ERROR", "API request failed or exceeded its timeout."),
    );
    if (requested.isErr()) return requested.error;
    const response = requested.value;
    if (response.status >= 300 && response.status < 400)
      return apiFailure(
        "API_REDIRECT_BLOCKED",
        "API redirects are not followed. Configure the final trusted endpoint.",
        response.status,
      );
    if (!response.ok) {
      const text = await ResultAsync.fromPromise(response.text(), () => "");
      const secrets = Object.values(headers).flatMap((value) =>
        value.startsWith("Bearer ") ? [value, value.slice(7)] : [value],
      );
      const message = redactApiMessage(
        text.unwrapOr("") || response.statusText || "API request failed.",
        secrets,
      );
      if (path.startsWith("/api/v2/")) {
        const decoded = Result.fromThrowable(
          () => JSON.parse(text.unwrapOr("")) as { error?: unknown },
          () => null,
        )();
        const parsed = ExecutionErrorSchema.safeParse(
          decoded.isOk() ? decoded.value?.error : undefined,
        );
        if (parsed.success) {
          const safeMessage = redactApiMessage(parsed.data.message, secrets);

          return {
            ...apiFailure(
              response.status === 401 || response.status === 403
                ? "API_UNAUTHORIZED"
                : parsed.data.code,
              safeMessage,
              response.status,
            ),
            error: { ...parsed.data, message: safeMessage },
          };
        }
      }

      return apiFailure(
        response.status === 401 || response.status === 403 ? "API_UNAUTHORIZED" : "API_HTTP_ERROR",
        message,
        response.status,
      );
    }
    if (responseType === "none") return { ok: true, data: undefined as T };
    const data = await ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        responseType === "bytes"
          ? response.arrayBuffer().then((value) => new Uint8Array(value))
          : response.json(),
      ),
      () =>
        apiFailure(
          "API_RESPONSE_INVALID",
          "API response could not be read or decoded.",
          response.status,
        ),
    );

    return data.isErr() ? data.error : { ok: true, data: data.value as T };
  };

  return {
    get: <T>(path: string) => request<T>("GET", path),
    getBytes: (path: string) => request<Uint8Array>("GET", path, undefined, "bytes"),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
    del: (path: string) => request<void>("DELETE", path, undefined, "none"),
  };
};

export const api = createApiClient();
