import { createFileRoute } from "@tanstack/react-router";
import { json, errorResponse } from "@/lib/apiResponse";
import { listDirectory } from "@repo/services";

export const Route = createFileRoute("/api/filesystem/tree")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const dirPath = url.searchParams.get("path");

        if (!dirPath) {
          return errorResponse("Missing 'path' query parameter", 400);
        }

        const result = await listDirectory(dirPath);

        if (result.isErr()) {
          const error = result.error;
          const status = error.type === "DirectoryNotFound" ? 404 : 400;
          return errorResponse(error.message, status);
        }

        return json(result.value);
      },
    },
  },
});
