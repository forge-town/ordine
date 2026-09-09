import type { Context } from "hono";
import { executionError } from "./errors";

export const executionNotFound = (context: Context) => {
  const legacy =
    context.req.path === "/health" ||
    (context.req.path.startsWith("/api/") && !context.req.path.startsWith("/api/v2/"));

  return context.json(
    {
      error: legacy
        ? executionError(
            "EXECUTION_API_VERSION_UNSUPPORTED",
            "This application only supports execution API v2. Update App and CLI/MCP together.",
          )
        : executionError("EXECUTION_NOT_FOUND", "Execution endpoint was not found."),
    },
    legacy ? 426 : 404,
  );
};
