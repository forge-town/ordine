import { beforeEach, describe, expect, it, vi } from "vitest";
const project = { id: "project-1", name: "Report" };
const findById = vi.fn();
const findPipelines = vi.fn();
const deleteProject = vi.fn();
vi.mock("@repo/models", () => ({
  createProjectsDao: () => ({ findById, delete: deleteProject }),
  createPipelinesDao: () => ({ findMany: findPipelines }),
}));
import { createProjectsService } from "../../projects.service";
describe("delete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findById.mockResolvedValue(project);
    findPipelines.mockResolvedValue([]);
    deleteProject.mockResolvedValue(undefined);
  });
  it("deletes an existing unreferenced project successfully", async () => {
    const result = await createProjectsService({} as never).delete("project-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });
  it("reports an unknown project without deleting", async () => {
    findById.mockResolvedValueOnce(undefined);
    const result = await createProjectsService({} as never).delete("project-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "Project",
      id: "project-1",
    });
    expect(deleteProject).not.toHaveBeenCalled();
    expect(findPipelines).not.toHaveBeenCalled();
  });
  it("protects a project referenced by a saved pipeline", async () => {
    findPipelines.mockResolvedValueOnce([{ id: "pipeline-1", projectId: "project-1" }]);
    const result = await createProjectsService({} as never).delete("project-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "ConflictError",
      message: 'Project "project-1" still has pipelines',
    });
    expect(deleteProject).not.toHaveBeenCalled();
  });
  it("maps a concurrent foreign-key violation to a conflict", async () => {
    deleteProject.mockRejectedValueOnce({ code: "23503" });
    const result = await createProjectsService({} as never).delete("project-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "ConflictError",
      message: 'Project "project-1" still has pipelines',
    });
  });
  it("retains the cause of other persistence failures", async () => {
    const cause = new Error("storage unavailable");
    deleteProject.mockRejectedValueOnce(cause);
    const result = await createProjectsService({} as never).delete("project-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
