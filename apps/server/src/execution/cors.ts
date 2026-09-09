import type { MiddlewareHandler } from "hono";
import {
  ExecutionAuthOptionsSchema,
  type ExecutionAuthEnv,
  type ExecutionAuthOptions,
} from "./auth";
import { executionError } from "./errors";

const methods = ["GET", "POST", "PUT", "OPTIONS"];
const headers = ["authorization", "x-desktop-token", "x-ordine-api-version", "content-type"];

/** Browser preflight has no credential; all actual requests still pass authentication. */
export const createExecutionCorsMiddleware = (
  options: ExecutionAuthOptions,
): MiddlewareHandler<ExecutionAuthEnv> => {
  const configuration = ExecutionAuthOptionsSchema.safeParse(options);
  if (!configuration.success) throw new Error("Execution authentication configuration is invalid.");
  const origins = configuration.data.allowedOrigins;

  return async (context, next) => {
    const origin = context.req.header("Origin");
    if (origin !== undefined && !origins.includes(origin))
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
    if (origin !== undefined) {
      context.header("Access-Control-Allow-Origin", origin);
      context.header("Vary", "Origin");
      context.header(
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Range, Content-Disposition, ETag, X-Ordine-Artifact-Sha256, X-Ordine-Readiness-Diagnostics",
      );
    }
    if (context.req.method === "OPTIONS") {
      const requestedMethod = context.req.header("Access-Control-Request-Method");
      const requestedHeaders = (context.req.header("Access-Control-Request-Headers") ?? "")
        .split(",")
        .map((header) => header.trim().toLowerCase())
        .filter(Boolean);
      if (
        !origin ||
        !requestedMethod ||
        !methods.includes(requestedMethod) ||
        requestedHeaders.some((header) => !headers.includes(header))
      )
        return context.json(
          {
            error: executionError(
              "EXECUTION_PREFLIGHT_INVALID",
              "Unsupported execution CORS preflight.",
              "authentication",
            ),
          },
          403,
        );
      context.header(
        "Vary",
        "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      );
      context.header("Access-Control-Allow-Methods", methods.join(", "));
      context.header("Access-Control-Allow-Headers", headers.join(", "));
      context.header("Access-Control-Max-Age", "600");

      return context.body(null, 204);
    }
    await next();
  };
};
