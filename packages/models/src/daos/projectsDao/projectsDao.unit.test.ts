import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "../../types";
import { createProjectsDao } from "./projectsDao";

const project = {
  id: "project-1",
  name: "Ordine",
  description: "",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const returning = vi.fn(() => Promise.resolve([project]));
const limit = vi.fn(() => Promise.resolve([project]));
const orderBy = vi.fn(() => Promise.resolve([project]));
const where = vi.fn(() => ({ limit, returning }));
const from = vi.fn(() => ({ orderBy, where }));
const values = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const executor = {
  select: vi.fn(() => ({ from })),
  insert: vi.fn(() => ({ values })),
  update: vi.fn(() => ({ set })),
  delete: vi.fn(() => ({ where })),
} as unknown as DbExecutor;

const dao = createProjectsDao(executor);

describe("ProjectsDao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements the standard CRUD interface", async () => {
    await expect(dao.findMany()).resolves.toEqual([project]);
    await expect(dao.findById(project.id)).resolves.toEqual(project);
    await expect(dao.create({ id: project.id, name: project.name })).resolves.toEqual(project);
    await expect(dao.update(project.id, { name: "Updated" })).resolves.toEqual(project);
    await expect(dao.delete(project.id)).resolves.toBeUndefined();

    expect(orderBy).toHaveBeenCalledOnce();
    expect(limit).toHaveBeenCalledWith(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
  });
});
