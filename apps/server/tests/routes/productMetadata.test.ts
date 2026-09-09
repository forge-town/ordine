import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProductMetadataRoutes,
  type ProductMetadataServices,
} from "../../src/routes/productMetadata";

const runtime = { id: "runtime-1", name: "Codex", type: "codex", connection: { mode: "local" } };
const project = {
  id: "project-1",
  name: "Example",
  description: "kept",
  owner: "owner",
  repo: "repo",
  branch: "dev",
  githubUrl: "https://github.com/owner/repo",
  isPrivate: true,
};
const template = {
  id: "template-1",
  name: "Template",
  description: "kept",
  content: "# title",
  contentType: "markdown",
};
const settings = {
  id: "default",
  defaultAgentRuntime: "codex",
  defaultApiKey: "",
  defaultModel: "model",
  defaultOutputPath: "",
};
const candidate = {
  id: "skill-1",
  name: "example",
  label: "Example",
  description: "Skill",
  path: "D:/skills/example/SKILL.md",
};
const crud = (record: { id: string }) => ({
  getAll: vi.fn(async () => [record]),
  getById: vi.fn(async () => record as object | null),
  create: vi.fn(async (input: unknown) => input),
  update: vi.fn(async (_id: string, input: unknown) => ({ ...record, ...(input as object) })),
  delete: vi.fn(async (_id: string) => undefined),
});
const services = {
  settings: {
    get: vi.fn(async () => settings),
    update: vi.fn(async (input: unknown) => ({ ...settings, ...(input as object) })),
  },
  runtimes: { ...crud(runtime), syncAll: vi.fn(async (input: unknown) => input) },
  githubProjects: crud(project),
  templates: crud(template),
  skills: {
    previewImport: vi.fn(async (_input: unknown) => ({ candidates: [candidate], errors: [] })),
    importCandidates: vi.fn(async (input: unknown) => input),
  },
};
const makeApp = () => {
  const app = new Hono();
  app.route("/api", createProductMetadataRoutes(services as unknown as ProductMetadataServices));

  return app;
};
const request = (path: string, method = "GET", body?: unknown) =>
  makeApp().request(`/api${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
beforeEach(() => vi.clearAllMocks());

describe.each([
  { path: "/agent-runtimes", record: runtime, service: services.runtimes },
  { path: "/github-projects", record: project, service: services.githubProjects },
  { path: "/operation-output-item-templates", record: template, service: services.templates },
])("Native metadata CRUD $path", ({ path, record, service }) => {
  it("returns a bare list and item for the Native Refine provider", async () => {
    const list = await request(path);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([record]);
    const item = await request(`${path}/${record.id}`);
    expect(item.status).toBe(200);
    expect(await item.json()).toEqual(record);
    expect(service.getById).toHaveBeenCalledWith(record.id);
  });
  it("validates and forwards creation without changing the payload", async () => {
    const response = await request(path, "POST", record);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(record);
    expect(service.create).toHaveBeenCalledWith(record);
  });
  it("updates only supplied fields and keeps defaults out of patches", async () => {
    const response = await request(`${path}/${record.id}`, "PATCH", { name: "Renamed" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...record, name: "Renamed" });
    expect(service.update).toHaveBeenCalledWith(record.id, { name: "Renamed" });
  });
  it("rejects unknown create/patch fields before calling the service", async () => {
    expect((await request(path, "POST", { ...record, unrecognized: true })).status).toBe(400);
    expect((await request(`${path}/${record.id}`, "PATCH", { id: "another" })).status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });
  it("deletes an existing record with a 204 response", async () => {
    const response = await request(`${path}/${record.id}`, "DELETE");
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(service.delete).toHaveBeenCalledWith(record.id);
  });
  it("returns 404 for missing records and does not delete them", async () => {
    service.getById.mockResolvedValueOnce(null);
    expect((await request(`${path}/missing`)).status).toBe(404);
    service.getById.mockResolvedValueOnce(null);
    expect((await request(`${path}/missing`, "DELETE")).status).toBe(404);
    expect(service.delete).not.toHaveBeenCalled();
  });
});

describe("Native settings and static metadata actions", () => {
  it("reads and patches the singleton settings with zero preserved", async () => {
    const response = await request("/settings/default");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(settings);
    const patch = { agentRuntimePreferences: { "runtime-1": { firstOutputTimeoutSeconds: 0 } } };
    expect((await request("/settings/default", "PATCH", patch)).status).toBe(200);
    expect(services.settings.update).toHaveBeenCalledWith(patch);
    expect((await request("/settings/another")).status).toBe(404);
  });
  it("rejects unknown settings fields including nested preferences", async () => {
    expect((await request("/settings/default", "PATCH", { id: "another" })).status).toBe(400);
    expect(
      (
        await request("/settings/default", "PATCH", {
          agentRuntimePreferences: { r: { injected: true } },
        })
      ).status,
    ).toBe(400);
    expect(services.settings.update).not.toHaveBeenCalled();
  });
  it("upserts runtime editor values through the existing sync service", async () => {
    const response = await request("/agent-runtimes/sync-all", "POST", { runtimes: [runtime] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([runtime]);
    expect(services.runtimes.syncAll).toHaveBeenCalledWith([runtime]);
  });
  it("rejects unsupported nested runtime connection fields", async () => {
    expect(
      (
        await request("/agent-runtimes", "POST", {
          ...runtime,
          connection: { mode: "local", injected: "value" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/agent-runtimes/sync-all", "POST", {
          runtimes: [runtime],
          deleteMissing: true,
        })
      ).status,
    ).toBe(400);
    expect(services.runtimes.create).not.toHaveBeenCalled();
    expect(services.runtimes.syncAll).not.toHaveBeenCalled();
  });
  it("passes Skill preview and import data to the existing service", async () => {
    const preview = await request("/skills/preview-import", "POST", { rootPath: "D:/skills" });
    expect(preview.status).toBe(200);
    expect(await preview.json()).toEqual({ candidates: [candidate], errors: [] });
    expect(services.skills.previewImport).toHaveBeenCalledWith({ rootPath: "D:/skills" });
    const imported = await request("/skills/import-candidates", "POST", {
      candidates: [candidate],
    });
    expect(imported.status).toBe(200);
    expect(await imported.json()).toEqual([candidate]);
    expect(services.skills.importCandidates).toHaveBeenCalledWith([candidate]);
  });
  it("rejects invalid Skill preview and candidate contracts", async () => {
    expect((await request("/skills/preview-import", "POST", { rootPath: "" })).status).toBe(400);
    expect(
      (
        await request("/skills/import-candidates", "POST", {
          candidates: [{ ...candidate, content: "unexpected" }],
        })
      ).status,
    ).toBe(400);
    expect(services.skills.previewImport).not.toHaveBeenCalled();
    expect(services.skills.importCandidates).not.toHaveBeenCalled();
  });
  it("responds to malformed JSON without invoking mutations", async () => {
    const response = await makeApp().request("/api/settings/default", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(response.status).toBe(400);
    expect(services.settings.update).not.toHaveBeenCalled();
  });
  it("returns a controlled server error without leaking service internals", async () => {
    services.settings.get.mockRejectedValueOnce(new Error("secret credentials at /private/path"));
    const response = await request("/settings/default");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Metadata service request failed" });
  });
});
