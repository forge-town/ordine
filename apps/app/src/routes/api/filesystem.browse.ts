import { createFileRoute } from "@tanstack/react-router";
import { json, errorResponse } from "@/lib/apiResponse";
import { listDirectory } from "@/services/filesystemService";

export const Route = createFileRoute("/api/filesystem/browse")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const dirPath = url.searchParams.get("path") ?? undefined;

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
