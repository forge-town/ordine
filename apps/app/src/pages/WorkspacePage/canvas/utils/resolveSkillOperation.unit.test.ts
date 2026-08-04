import type { DataProvider } from "@refinedev/core";
import type { Operation, Skill } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { resolveSkillOperation } from "./resolveSkillOperation";

const skill = {
  category: "quality",
  description: "Reviews files",
  id: "review",
  label: "Review",
  name: "review",
  tags: [],
} satisfies Skill;

const operation = {
  acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
  config: {
    executor: { agentMode: "skill", skillId: skill.id, type: "agent" },
    inputs: [],
    outputs: [],
  },
  description: skill.description,
  id: `skill-operation-${skill.id}`,
  name: skill.label,
  sourceSkillId: skill.id,
} satisfies Operation;

const makeDataProvider = (operations: Operation[]) => {
  const create = vi.fn(async () => ({ data: operation }));
  const getList = vi.fn(async () => ({ data: operations, total: operations.length }));

  return {
    create,
    dataProvider: { create, getList } as unknown as DataProvider,
    getList,
  };
};

describe("resolveSkillOperation", () => {
  it("reuses an existing skill-backed operation", async () => {
    const { create, dataProvider } = makeDataProvider([operation]);

    await expect(resolveSkillOperation(dataProvider, skill)).resolves.toBe(operation);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a real backing operation when none exists", async () => {
    const { create, dataProvider } = makeDataProvider([]);

    await expect(resolveSkillOperation(dataProvider, skill)).resolves.toEqual(operation);
    expect(create).toHaveBeenCalledWith({
      resource: "operations",
      variables: operation,
    });
  });

  it("deduplicates concurrent resolutions for the same skill", async () => {
    const releaseList = vi.fn<() => void>();
    const listPending = new Promise<void>((resolve) => {
      releaseList.mockImplementation(resolve);
    });
    const { create, dataProvider, getList } = makeDataProvider([]);
    getList.mockImplementation(async () => {
      await listPending;

      return { data: [], total: 0 };
    });

    const first = resolveSkillOperation(dataProvider, skill);
    const second = resolveSkillOperation(dataProvider, skill);
    releaseList();

    await expect(Promise.all([first, second])).resolves.toEqual([operation, operation]);
    expect(getList).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
