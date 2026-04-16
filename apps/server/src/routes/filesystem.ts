import { Hono } from "hono";
import { listDirectory } from "../services.js";

export const filesystemRoutes = new Hono();

filesystemRoutes.get("/browse", async (c) => {
  const dirPath = c.req.query("path") ?? undefined;
  const result = await listDirectory(dirPath);

  if (result.isErr()) {
    const error = result.error;
    const status = error.type === "DirectoryNotFound" ? 404 : 400;

    return c.json({ error: error.message }, status);
  }

  return c.json(result.value);
});

filesystemRoutes.get("/tree", async (c) => {
  const dirPath = c.req.query("path");
  if (!dirPath) {
    return c.json({ error: "Missing 'path' query parameter" }, 400);
  }

  const result = await listDirectory(dirPath);

  if (result.isErr()) {
    const error = result.error;
    const status = error.type === "DirectoryNotFound" ? 404 : 400;

    return c.json({ error: error.message }, status);
  }

  return c.json(result.value);
});
