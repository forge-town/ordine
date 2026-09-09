import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import type { z } from "zod/v4";
import { MetadataIdSchema } from "./productMetadataSchemas";
import { resultJson, resultNoContent, validateJson, validationErrorJson } from "./result";

export const metadataResult = <T>(action: () => Promise<T>) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(action),
    () => new Error("Metadata service request failed"),
  );

export const createMetadataCrudRoutes = <Create extends z.ZodType, Patch extends z.ZodType>({
  service,
  createSchema,
  patchSchema,
}: {
  createSchema: Create;
  patchSchema: Patch;
  service: {
    getAll: () => Promise<unknown[]>;
    getById: (id: string) => Promise<unknown>;
    create: (input: z.output<Create>) => Promise<unknown>;
    update: (id: string, input: z.output<Patch>) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
}) => {
  const router = new Hono();
  router.get("/", async (c) => resultJson(c, await metadataResult(() => service.getAll())));
  router.post("/", async (c) => {
    const parsed = await validateJson(c, createSchema);
    if (!parsed.success) return validationErrorJson(c);

    return resultJson(c, await metadataResult(() => service.create(parsed.data)), 201);
  });
  router.get("/:id", async (c) => {
    const parsed = MetadataIdSchema.safeParse(c.req.param());
    if (!parsed.success) return validationErrorJson(c);
    const result = await metadataResult(() => service.getById(parsed.data.id));
    if (result.isOk() && !result.value) return c.json({ error: "Resource not found" }, 404);

    return resultJson(c, result);
  });
  router.patch("/:id", async (c) => {
    const params = MetadataIdSchema.safeParse(c.req.param());
    const parsed = await validateJson(c, patchSchema);
    if (!params.success || !parsed.success) return validationErrorJson(c);
    const result = await metadataResult(() => service.update(params.data.id, parsed.data));
    if (result.isOk() && !result.value) return c.json({ error: "Resource not found" }, 404);

    return resultJson(c, result);
  });
  router.delete("/:id", async (c) => {
    const params = MetadataIdSchema.safeParse(c.req.param());
    if (!params.success) return validationErrorJson(c);
    const existing = await metadataResult(() => service.getById(params.data.id));
    if (existing.isErr()) return resultJson(c, existing);
    if (!existing.value) return c.json({ error: "Resource not found" }, 404);

    return resultNoContent(c, await metadataResult(() => service.delete(params.data.id)));
  });

  return router;
};
