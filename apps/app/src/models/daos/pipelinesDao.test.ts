import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineEntity } from "@repo/models";
import type * as DrizzleOrm from "drizzle-orm";

// ─── Mock DB ─────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

vi.mock("@repo/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: mockUpdate,
    delete: vi.fn(),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
    desc: vi.fn((col) => ({ col, type: "desc" })),
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

const makeRow = (id: string) => ({
  id,
  name: "Test Pipeline",
  description: "desc",
  tags: [] as string[],
  nodes: [],
  edges: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

describe("pipelinesDao.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls db.update with nodes and edges patch and returns updated entity", async () => {
    const returnedRow = makeRow("pipe-1");
    mockReturning.mockResolvedValueOnce([returnedRow]);

    // Import after mocks are set up
    const { pipelinesDao } = await import("@repo/models");

    const testNodes = [
      {
        id: "node-1",
        type: "condition",
        position: { x: 0, y: 0 },
        data: {
          nodeType: "condition" as const,
          label: "验收条件",
          expression: "",
          expectedResult: "",
          status: "idle" as const,
        },
      },
    ] satisfies PipelineEntity["nodes"];

    const result = await pipelinesDao.update("pipe-1", {
      nodes: testNodes,
      edges: [],
    });

    // Verify db.update was called
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Verify .set() received nodes and edges
    const setPayload = (mockSet.mock.calls as Array<Array<Record<string, unknown>>>)[0]?.[0];
    expect(setPayload).toBeDefined();
    expect(setPayload["nodes"]).toEqual(testNodes);
    expect(setPayload["edges"]).toEqual([]);
    expect(setPayload["updatedAt"]).toBeInstanceOf(Date);

    // Verify result entity has correct timestamps (number)
    expect(result).not.toBeNull();
    expect(result?.id).toBe("pipe-1");
    expect(typeof result?.createdAt).toBe("number");
    expect(typeof result?.updatedAt).toBe("number");
    expect(result?.nodeCount).toBe(0);
  });

  it("returns null when no rows are updated", async () => {
    mockReturning.mockResolvedValueOnce([]);

    const { pipelinesDao } = await import("@repo/models");

    const result = await pipelinesDao.update("nonexistent-id", { name: "x" });

    expect(result).toBeNull();
  });

  it("only sends whitelisted fields (ignores id, nodeCount, createdAt, updatedAt from patch)", async () => {
    const returnedRow = makeRow("pipe-99");
    mockReturning.mockResolvedValueOnce([returnedRow]);

    const { pipelinesDao } = await import("@repo/models");

    await pipelinesDao.update("pipe-99", {
      name: "Updated Name",
      description: "New desc",
    });

    const setPayload = (mockSet.mock.calls as Array<Array<Record<string, unknown>>>)[0]?.[0];
    // Should have name, description, updatedAt from internal logic
    expect(setPayload["name"]).toBe("Updated Name");
    expect(setPayload["description"]).toBe("New desc");
    // Should NOT have nodeCount, createdAt from patch (they're omitted by the DAO type)
    expect("nodeCount" in setPayload).toBe(false);
  });
});
