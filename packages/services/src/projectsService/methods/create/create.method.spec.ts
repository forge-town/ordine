import { describe, expect, it, vi } from "vitest";
const storedProject = {
  id: "project-1",
  name: "Report",
  description: "Weekly work",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const operation = vi.fn().mockResolvedValue(storedProject);
vi.mock("@repo/models", () => ({
  createProjectsDao: () => ({ create: operation }),
  createPipelinesDao: () => ({}),
}));
import { createProjectsService } from "../../projects.service";
describe("create", () => {
  it("returns the persisted project shape in an Ok result", async () => {
    const result = await createProjectsService({} as never).create({
      id: "project-1",
      name: "Report",
      description: "Weekly work",
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(storedProject);
  });
  it("maps persistence failures to ServiceError with the original cause", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const result = await createProjectsService({} as never).create({
      id: "project-1",
      name: "Report",
      description: "Weekly work",
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause: error });
  });
});
