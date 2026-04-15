import { describe, it, expect } from "vitest";
import { buildExecutionLevels, getParentIds } from "./dagScheduler";

interface TestNode {
  id: string;
  type: string;
}

describe("dagScheduler", () => {
  describe("buildExecutionLevels", () => {
    it("returns a single level for a single node", () => {
      const nodes: TestNode[] = [{ id: "a", type: "folder" }];
      const result = buildExecutionLevels(nodes, []);
      expect(result.isOk()).toBe(true);
      const levels = result._unsafeUnwrap();
      expect(levels).toEqual([[{ id: "a", type: "folder" }]]);
    });

    it("returns sequential levels for a linear chain", () => {
      const nodes: TestNode[] = [
        { id: "a", type: "folder" },
        { id: "b", type: "operation" },
        { id: "c", type: "output" },
      ];
      const edges = [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ];
      const result = buildExecutionLevels(nodes, edges);
      expect(result.isOk()).toBe(true);
      const levels = result._unsafeUnwrap();
      expect(levels).toHaveLength(3);
      expect(levels[0]!.map((n: TestNode) => n.id)).toEqual(["a"]);
      expect(levels[1]!.map((n: TestNode) => n.id)).toEqual(["b"]);
      expect(levels[2]!.map((n: TestNode) => n.id)).toEqual(["c"]);
    });

    it("places fan-out targets at the same level", () => {
      const nodes: TestNode[] = [
        { id: "input", type: "folder" },
        { id: "check_a", type: "operation" },
        { id: "check_b", type: "operation" },
        { id: "check_c", type: "operation" },
      ];
      const edges = [
        { source: "input", target: "check_a" },
        { source: "input", target: "check_b" },
        { source: "input", target: "check_c" },
      ];
      const result = buildExecutionLevels(nodes, edges);
      expect(result.isOk()).toBe(true);
      const levels = result._unsafeUnwrap();
      expect(levels).toHaveLength(2);
      expect(levels[0]!.map((n: TestNode) => n.id)).toEqual(["input"]);
      expect(levels[1]!.map((n: TestNode) => n.id).sort()).toEqual([
        "check_a",
        "check_b",
        "check_c",
      ]);
    });

    it("handles full fan-out + fan-in DAG", () => {
      const nodes: TestNode[] = [
        { id: "input", type: "folder" },
        { id: "check_dao", type: "operation" },
        { id: "check_schema", type: "operation" },
        { id: "check_store", type: "operation" },
        { id: "output_dao", type: "output" },
        { id: "output_schema", type: "output" },
        { id: "output_store", type: "output" },
      ];
      const edges = [
        { source: "input", target: "check_dao" },
        { source: "input", target: "check_schema" },
        { source: "input", target: "check_store" },
        { source: "check_dao", target: "output_dao" },
        { source: "check_schema", target: "output_schema" },
        { source: "check_store", target: "output_store" },
      ];
      const result = buildExecutionLevels(nodes, edges);
      expect(result.isOk()).toBe(true);
      const levels = result._unsafeUnwrap();
      expect(levels).toHaveLength(3);
      expect(levels[0]!.map((n: TestNode) => n.id)).toEqual(["input"]);
      expect(levels[1]!.map((n: TestNode) => n.id).sort()).toEqual([
        "check_dao",
        "check_schema",
        "check_store",
      ]);
      expect(levels[2]!.map((n: TestNode) => n.id).sort()).toEqual([
        "output_dao",
        "output_schema",
        "output_store",
      ]);
    });

    it("handles diamond dependency (fan-out then fan-in)", () => {
      const nodes: TestNode[] = [
        { id: "A", type: "input" },
        { id: "B", type: "op" },
        { id: "C", type: "op" },
        { id: "D", type: "output" },
      ];
      const edges = [
        { source: "A", target: "B" },
        { source: "A", target: "C" },
        { source: "B", target: "D" },
        { source: "C", target: "D" },
      ];
      const result = buildExecutionLevels(nodes, edges);
      expect(result.isOk()).toBe(true);
      const levels = result._unsafeUnwrap();
      expect(levels).toHaveLength(3);
      expect(levels[0]!.map((n: TestNode) => n.id)).toEqual(["A"]);
      expect(levels[1]!.map((n: TestNode) => n.id).sort()).toEqual(["B", "C"]);
      expect(levels[2]!.map((n: TestNode) => n.id)).toEqual(["D"]);
    });

    it("returns err on cyclic graph", () => {
      const nodes: TestNode[] = [
        { id: "a", type: "op" },
        { id: "b", type: "op" },
      ];
      const edges = [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ];
      const result = buildExecutionLevels(nodes, edges);
      expect(result.isErr()).toBe(true);
    });

    it("handles multiple root nodes", () => {
      const nodes: TestNode[] = [
        { id: "root1", type: "folder" },
        { id: "root2", type: "folder" },
        { id: "merge", type: "operation" },
      ];
      const edges = [
        { source: "root1", target: "merge" },
        { source: "root2", target: "merge" },
      ];
      const result = buildExecutionLevels(nodes, edges);
      expect(result.isOk()).toBe(true);
      const levels = result._unsafeUnwrap();
      expect(levels).toHaveLength(2);
      expect(levels[0]!.map((n: TestNode) => n.id).sort()).toEqual(["root1", "root2"]);
      expect(levels[1]!.map((n: TestNode) => n.id)).toEqual(["merge"]);
    });

    it("handles empty graph", () => {
      const result = buildExecutionLevels([], []);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([]);
    });
  });

  describe("getParentIds", () => {
    it("returns parent IDs for a given node", () => {
      const edges = [
        { source: "a", target: "c" },
        { source: "b", target: "c" },
        { source: "c", target: "d" },
      ];
      expect(getParentIds("c", edges).sort()).toEqual(["a", "b"]);
    });

    it("returns empty array for root nodes", () => {
      const edges = [{ source: "a", target: "b" }];
      expect(getParentIds("a", edges)).toEqual([]);
    });
  });
});
